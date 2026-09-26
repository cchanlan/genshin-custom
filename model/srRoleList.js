import fs from "node:fs"
import lodash from "lodash"
import moment from "moment"
import base from "./base.js"
import MysInfo from "./mys/mysInfo.js"
import { Artifact, Character, Weapon } from "#miao.models"

/** 接口给的属性是英文，本地图标文件名是中文 */
const elemName = {
  fire: "火",
  ice: "冰",
  lightning: "雷",
  wind: "风",
  quantum: "量子",
  imaginary: "虚数",
  physical: "物理",
}

const regionName = {
  prod_gf_cn: "星穹列车",
  prod_qd_cn: "星穹列车",
  prod_official_usa: "美服",
  prod_official_euro: "欧服",
  prod_official_asia: "亚服",
  prod_official_cht: "港澳台服",
}

/** 行迹里要显示的四项，秘技等级恒为 1 不展示 */
const talentName = ["普攻", "战技", "终结技", "天赋"]

export default class SrRoleList extends base {
  constructor(e) {
    super(e)
    this.model = "srRoleList"
  }

  static async get(e) {
    return await new SrRoleList(e).roleList()
  }

  async roleList() {
    // index 一次就给全部角色（含光锥、星魂、等级），不必再拉角色列表接口
    let res = await MysInfo.get(this.e, { index: "", basicInfo: "" })
    if (!res) return false

    let index = res.find(v => v?.api === "index") ?? res[0]
    let basic = res.find(v => v?.api === "basicInfo") ?? res[1]
    if (!index || index.retcode !== 0) return false

    let extra = await this.getExtra()
    return this.dealData(index.data, basic?.retcode === 0 ? basic.data : {}, extra)
  }

  /**
   * 行迹等级与遗器都只在角色面板接口里，且必须是查询者自己的 ck，
   * 拿不到就只是卡片上不显示这两块，不影响其余内容
   */
  async getExtra() {
    let talent = {}
    let artis = {}
    let noTips = this.e.noTips
    try {
      this.e.noTips = true
      let res = await MysInfo.get(this.e, "avatarInfo")
      if (!res || res.retcode !== 0) return { talent, artis }

      for (let ds of res.data?.avatar_list || []) {
        let main = lodash.filter(ds.skills, v => v.point_type === 2)
        let list = []
        for (let name of talentName) {
          let level = lodash.find(main, v => v.remake === name)?.level
          // 满级判据：普攻上限 6，其余三项上限 10（星魂加成会超过，一并算满）
          if (level > 0) list.push({ level, full: level >= (name === "普攻" ? 6 : 10) })
        }
        if (list.length) talent[ds.id] = list

        let sets = this.getRelicSets(ds)
        if (sets.length) artis[ds.id] = sets
      }
    } catch (err) {
      logger.error(`[星铁角色列表][行迹/遗器] ${err}`)
    } finally {
      this.e.noTips = noTips
    }
    return { talent, artis }
  }

  /**
   * 遗器按套装归并：外圈 4 件在 relics、内圈 2 件在 ornaments，
   * 混搭时可能凑出好几个套装，只取件数最多的两个做图标
   */
  getRelicSets(ds) {
    let sets = {}
    for (let item of [ ...(ds.relics || []), ...(ds.ornaments || []) ]) {
      let arti = Artifact.get(item?.id, "sr")
      let name = arti?.setName
      if (!name) continue
      if (!sets[name]) sets[name] = { name, img: this.miaoImg(arti.artiSet?.img || arti.img), count: 0 }
      sets[name].count++
    }
    return lodash.orderBy(Object.values(sets), ["count"], ["desc"]).slice(0, 2)
  }

  /** 资源包没跟上新角色时回退到米游社在线图 */
  miaoImg(path) {
    if (!path) return ""
    return fs.existsSync(`${this._path}/plugins/miao-plugin/resources/${path.replace(/^\//, "")}`)
      ? path
      : ""
  }

  /** 星铁属性图标是插件自带的，新属性没图时让模板不画 */
  srImg(path) {
    return fs.existsSync(`${this._path}/plugins/genshin/resources/${path}`) ? path : ""
  }

  dealData(index, basic, extra) {
    let stats = index?.stats || {}
    let { talent = {}, artis = {} } = extra || {}

    let avatars = []
    let star5 = 0
    let goldCount = 0

    for (let ds of index?.avatar_list || []) {
      let char = Character.get(ds.id, "sr")

      if (ds.rarity >= 5) {
        star5++
        goldCount += (ds.rank || 0) + 1
      }
      if (ds.equip?.rarity >= 5) goldCount += ds.equip.rank || 1

      let cone = false
      if (ds.equip) {
        let weapon = Weapon.get(ds.equip.name, "sr")
        cone = {
          name: ds.equip.name,
          star: ds.equip.rarity,
          rank: ds.equip.rank,
          // 叠影按游戏里的写法用罗马数字
          rankText: ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"][(ds.equip.rank || 1) - 1] || "Ⅰ",
          starText: "★".repeat(ds.equip.rarity || 3),
          level: ds.equip.level,
          img: this.miaoImg(weapon?.imgs?.icon || weapon?.img),
          icon: ds.equip.icon,
        }
      }

      let elem = elemName[ds.element] || ""
      let path = char?.weapon || ""

      avatars.push({
        id: ds.id,
        // miao 的简称能区分开拓者命途、三月七两个版本，接口的 name 是重名的
        name: char?.abbr || char?.name || ds.name,
        level: ds.level,
        rank: ds.rank || 0,
        star: ds.rarity >= 5 ? 5 : 4,
        elem,
        elemImg: elem ? this.srImg(`StarRail/img/items/${elem}.webp`) : "",
        // 命途图标 miao 那边九条命途都有（含记忆、欢愉），插件自带的那套缺后两条。
        // 优先 s 版：那是给小尺寸画的粗线版，612px 的大图缩到 15px 会糊成一团
        pathImg: path
          ? this.miaoImg(`meta-sr/public/icons/type-${path}s.webp`) ||
            this.miaoImg(`meta-sr/public/icons/type-${path}.webp`)
          : "",
        // 卡片左边是竖版立绘，资源包没这个角色时退回接口的立绘图
        img: this.miaoImg(char?.imgs?.preview),
        // 米游社那套卡片用的是 256×256 的透明胸像，比全身立绘放大后更清晰
        face: this.miaoImg(char?.imgs?.face),
        icon: ds.figure_path || ds.icon,
        talent: talent[ds.id] || [],
        artis: artis[ds.id] || [],
        cone,
      })
    }

    avatars = lodash.orderBy(avatars, ["level", "star", "rank", "id"], ["desc", "desc", "desc", "desc"])

    // 标签跟着米游社个人主页的口径写
    let topLine = [
      { lable: "活跃天数", num: stats.active_days ?? 0 },
      { lable: "已解锁角色", num: stats.avatar_num ?? avatars.length },
      { lable: "战利品开启", num: stats.chest_num ?? 0 },
    ]

    let items = [{ lable: "达成成就数", num: stats.achievement_num ?? 0 }]
    if (stats.abyss_process) items.push({ lable: "逐光捡金", num: stats.abyss_process, small: true })
    if (stats.season_title) items.push({ lable: "差分宇宙", num: stats.season_title, small: true })
    items.push(
      { lable: "梦境护照", num: stats.dream_paster_num ?? 0 },
      { lable: "五星角色", num: star5 },
      { lable: "金卡数", num: goldCount },
    )

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      // 图很长，jpeg 默认 90 在 QQ 二次压缩后字会发虚
      quality: 96,
      name: basic?.nickname || `#${this.e.uid}`,
      level: basic?.level ?? 0,
      avatar: basic?.avatar || index?.cur_head_icon_url || "",
      region: regionName[basic?.region] || "星穹列车",
      rankIcon: stats.peak_rank_icon || "",
      topLine,
      items,
      avatars,
      updateTime: moment().format("MM-DD HH:mm"),
      ...this.screenData,
    }
  }
}
