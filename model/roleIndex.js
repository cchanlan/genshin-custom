import base from "./base.js"
import MysInfo from "./mys/mysInfo.js"
import gsCfg from "./gsCfg.js"
import lodash from "lodash"
import moment from "moment"
import fs from "node:fs"
import { Character } from "#miao.models"

let imgFile = {}

export default class RoleIndex extends base {
  constructor(e) {
    super(e)
    this.model = "roleIndex"
    this.other = gsCfg.getdefSet("role", "other")
    this.wother = gsCfg.getdefSet("weapon", "other")
    this.lable = gsCfg.getdefSet("role", "index")

    // 地区 id -> 显示名。只用于「把接口原名换成短名」，
    // 新地区不登记也能正常显示（会用接口原名，超 6 字截断）
    this.area = {
      蒙德: 1,
      璃月: 2,
      雪山: 3,
      稻妻: 4,
      渊下宫: 5,
      层岩巨渊: 6,
      层岩地下: 7,
      须弥: 8,
      枫丹: 9,
      沉玉谷: 10,
      来歆山: 11,
      沉玉谷·南陵: 12,
      沉玉谷·上谷: 13,
      旧日之海: 14,
      纳塔: 15,
      远古圣山: 16,
      挪德卡莱: 17,
    }

    this.all_chest = 0
    lodash.forEach(this.lable, (v, i) => {
      if (i.includes("_chest")) this.all_chest += v
    })

    this.areaName = lodash.invert(this.area)

    this.headIndexStyle = `<style> .head_box { background: url(${this.screenData.pluResPath}img/roleIndex/namecard/${lodash.random(1, 8)}.png) #f5f5f5; background-position-x: 30px; background-repeat: no-repeat; border-radius: 15px; font-family: tttgbnumber; padding: 10px 20px; position: relative; background-size: auto 101%; }</style>`
  }

  static async get(e) {
    let roleIndex = new RoleIndex(e)
    return await roleIndex.getIndex()
  }

  async getIndex() {
    let ApiData = {
      index: "",
      spiralAbyss: { schedule_type: 1 },
      character: "",
      basicInfo: "",
    }
    let res = await MysInfo.get(this.e, ApiData)

    if (!res || res[0].retcode !== 0 || res[2].retcode !== 0) return false

    let ret = []
    res.forEach(v => ret.push(v.data))

    /** 截图数据 */
    let data = {
      quality: 80,
      ...this.screenData,
      ...this.dealData(ret),
    }
    // console.log(...this.dealData(ret))
    return data
  }

  dealData(data) {
    let [resIndex, resAbyss, resDetail, basicInfo] = data

    let avatars = resDetail.avatars || []
    let roleArr = avatars

    for (let i in avatars) {
      let rarity = avatars[i].rarity
      let liveNum = avatars[i].actived_constellation_num
      let level = avatars[i].level
      let id = avatars[i].id - 10000000

      if (rarity >= 5) {
        rarity = 5
      }
      // 埃洛伊排到最后
      if (rarity > 5) {
        id = 0
      }
      // 增加神里排序
      if (avatars[i].id == 10000002) {
        id = 50
      }

      if (avatars[i].id == 10000005) {
        avatars[i].name = "空"
        liveNum = 0
        level = 0
      } else if (avatars[i].id == 10000007) {
        avatars[i].name = "荧"
        liveNum = 0
        level = 0
      }
      avatars[i].sortLevel = level
      // id倒序，最新出的角色拍前面
      avatars[i].sort = rarity * 100000 + liveNum * 10000 + level * 100 + id

      avatars[i].weapon.showName =
        this.wother.sortName[avatars[i].weapon.name] ?? avatars[i].weapon.name

      avatars[i].costumesLogo = ""
      if (avatars[i].costumes && avatars[i].costumes.length >= 1) {
        for (let val of avatars[i].costumes) {
          if (this.other.costumes.includes(val.name)) {
            avatars[i].costumesLogo = 2
            break
          }
        }
      }
    }

    let stats = resIndex.stats || {}

    let percentage = lodash.round(
      ((stats.precious_chest_number +
        stats.luxurious_chest_number +
        stats.exquisite_chest_number +
        stats.common_chest_number +
        stats.magic_chest_number) /
        this.all_chest) *
        100,
      1,
    )

    let afterPercentage =
      (percentage < 60
        ? "D"
        : percentage < 70
          ? "C"
          : percentage < 80
            ? "B"
            : percentage < 90
              ? "A"
              : "S") + `[${percentage}%]`

    let line = [
      [
        { lable: "成就", num: stats.achievement_number, extra: this.lable.achievement },
        { lable: "角色数", num: stats.avatar_number, extra: this.lable.avatar },
        { lable: "等级", num: resIndex?.role?.level ?? 0, extra: this.lable.level },
        {
          lable: "总宝箱",
          num:
            stats.precious_chest_number +
            stats.luxurious_chest_number +
            stats.exquisite_chest_number +
            stats.common_chest_number +
            stats.magic_chest_number,
          extra: this.all_chest,
        },
        {
          lable: "获取率",
          num: afterPercentage,
          color:
            afterPercentage.substr(0, 1) == "D"
              ? "#12a182"
              : afterPercentage.substr(0, 1) == "C"
                ? "#2775b6"
                : afterPercentage.substr(0, 1) == "B"
                  ? "#806d9e"
                  : afterPercentage.substr(0, 1) == "A"
                    ? "#c04851"
                    : afterPercentage.substr(0, 1) == "S"
                      ? "#f86b1d"
                      : "",
        },
      ],
      [
        { lable: "华丽宝箱", num: stats.luxurious_chest_number, extra: this.lable.luxurious_chest },
        { lable: "珍贵宝箱", num: stats.precious_chest_number, extra: this.lable.precious_chest },
        { lable: "精致宝箱", num: stats.exquisite_chest_number, extra: this.lable.exquisite_chest },
        { lable: "普通宝箱", num: stats.common_chest_number, extra: this.lable.common_chest },
      ],
    ]

    // 尘歌壶
    let homesLevel = 0
    // let homesItem = 0
    if (resIndex.homes && resIndex.homes.length > 0) {
      homesLevel = resIndex.homes[0].level
      // homesItem = resIndex.homes[0].item_num
    }

    let worldExplorations = lodash.keyBy(resIndex.world_explorations, "id")

    let explor = []
    let explor2 = []

    let expArr = ["纳塔", "枫丹", "须弥", "层岩巨渊", "渊下宫"]
    let expArr2 = ["稻妻", "雪山", "璃月", "蒙德"]

    for (let val of expArr) {
      let tmp = {
        lable: val,
        num: `${(worldExplorations[this.area[val]]?.exploration_percentage ?? 0) / 10}%`,
      }
      explor.push(tmp)
    }

    for (let val of expArr2) {
      let tmp = {
        lable: val,
        num: `${(worldExplorations[this.area[val]]?.exploration_percentage ?? 0) / 10}%`,
      }
      explor2.push(tmp)
    }

    explor2.push({ lable: "家园等级", num: homesLevel })

    line.push(explor)
    line.push(explor2)

    if (avatars.length > 0) {
      // 重新排序
      avatars = lodash.chain(avatars).orderBy(["sortLevel"], ["desc"])
      if (this.e.msg.includes("角色")) {
        avatars = avatars.slice(0, 12)
      }
      avatars = avatars.orderBy(["sort"], ["desc"]).value()
    }

    // 深渊
    let abyss = this.abyssAll(roleArr, resAbyss)

    return {
      uid: this.e.uid,
      saveId: this.e.uid,
      activeDay: this.dayCount(stats.active_day_number),
      line,
      basicInfo,
      avatars,
      abyss,
      headIndexStyle: this.headIndexStyle,
    }
  }

  // 处理深渊数据
  abyssAll(roleArr, resAbyss) {
    let abyss = {}

    if (roleArr.length <= 0) {
      return abyss
    }
    if (resAbyss?.total_battle_times <= 0) {
      return abyss
    }
    if (resAbyss?.reveal_rank.length <= 0) {
      return abyss
    }
    // 打了三层才放出来
    if (resAbyss?.floors.length <= 2) {
      return abyss
    }

    let startTime = moment(resAbyss.startTime)
    let time = Number(startTime.month()) + 1 + "月"

    let totalStar = 0
    let star = []
    for (let val of resAbyss.floors) {
      if (val.index < 9) {
        continue
      }
      totalStar += val.star
      star.push(val.star)
    }
    totalStar = totalStar + "（" + star.join("-") + "）"

    let dataName = ["damage", "take_damage", "defeat", "normal_skill", "energy_skill"]
    let data = []
    let tmpRole = []
    for (let val of dataName) {
      if (resAbyss[`${val}_rank`].length <= 0) {
        resAbyss[`${val}_rank`] = [
          {
            value: 0,
            avatar_id: 10000007,
          },
        ]
      }
      data[val] = {
        num: resAbyss[`${val}_rank`][0].value,
        name: gsCfg.roleIdToName(resAbyss[`${val}_rank`][0].avatar_id),
      }

      if (data[val].num > 1000) {
        data[val].num = (data[val].num / 10000).toFixed(1)
        data[val].num += " w"
      }

      if (tmpRole.length < 4 && !tmpRole.includes(resAbyss[`${val}_rank`][0].avatar_id)) {
        tmpRole.push(resAbyss[`${val}_rank`][0].avatar_id)
      }
    }

    let list = []

    let avatar = lodash.keyBy(roleArr, "id")

    for (let val of resAbyss.reveal_rank) {
      if (avatar[val.avatar_id]) {
        val.life = avatar[val.avatar_id].actived_constellation_num
      } else {
        val.life = 0
      }
      val.name = gsCfg.roleIdToName(val.avatar_id)
      list.push(val)
    }

    return {
      time,
      max_floor: resAbyss.max_floor,
      totalStar,
      list,
      total_battle_times: resAbyss.total_battle_times,
      ...data,
    }
  }

  dayCount(num) {
    let daysDifference =
      Math.floor((new Date() - new Date("2020-09-15")) / (1000 * 60 * 60 * 24)) + 1
    let days = Math.floor(num)
    let msg = "活跃天数：" + days + `/${daysDifference}天`
    return msg
  }

  /**
   * 神瞳列表
   * 自动抓取接口里所有 xxxculus_number 字段，游戏出新神瞳时代码无需改动，
   * 只要在 defSet/role/index.yaml 里补显示名和上限即可（不补也能显示，只是名字是英文）
   */
  getOculusList(stats) {
    let names = this.lable.oculus ?? {}
    let order = Object.keys(names)

    let list = []
    for (let key in stats) {
      let id = key.match(/^(\w+culus)_number$/)?.[1]
      if (!id) continue

      let sort = order.indexOf(id)
      list.push({
        lable: names[id] ?? id,
        num: stats[key],
        extra: this.lable[id] ?? 0,
        // 未登记的排到最后
        sort: sort < 0 ? order.length : sort,
      })
    }

    return lodash.sortBy(list, "sort").map(v => lodash.omit(v, "sort"))
  }

  async roleCard() {
    this.model = "roleCard"
    let res = await MysInfo.get(this.e, "index")

    if (!res || res.retcode !== 0) return false

    return this.roleCardData(res.data)
  }

  roleCardData(res) {
    let stats = res.stats
    let line = [
      [
        { lable: "活跃天数", num: stats.active_day_number },
        { lable: "成就", num: stats.achievement_number },
        { lable: "角色数", num: stats.avatar_number },
        { lable: "等级", num: res?.role?.level ?? 0 },
        {
          lable: "总宝箱",
          num:
            stats.precious_chest_number +
            stats.luxurious_chest_number +
            stats.exquisite_chest_number +
            stats.common_chest_number +
            stats.magic_chest_number,
        },
      ],
      [
        { lable: "华丽宝箱", num: stats.luxurious_chest_number },
        { lable: "珍贵宝箱", num: stats.precious_chest_number },
        { lable: "精致宝箱", num: stats.exquisite_chest_number },
        { lable: "普通宝箱", num: stats.common_chest_number },
        { lable: "奇馈宝箱", num: stats.magic_chest_number },
        { lable: "传送点", num: stats.way_point_number },
      ],
    ]

    let explor1 = []
    let explor2 = []

    res.world_explorations = lodash.orderBy(res.world_explorations, ["id"], ["desc"])

    for (let val of res.world_explorations) {
      val.name = this.areaName[val.id]
        ? this.areaName[val.id]
        : lodash.truncate(val.name, { length: 6 })

      let tmp = { lable: val.name, num: `${val.exploration_percentage / 10}%` }

      if (explor1.length < 5) {
        explor1.push(tmp)
      } else {
        explor2.push(tmp)
      }
    }

    explor2 = explor2.concat([
      { lable: "火神瞳", num: stats.pyroculus_number },
      { lable: "水神瞳", num: stats.hydroculus_number },
      { lable: "草神瞳", num: stats.dendroculus_number },
      { lable: "雷神瞳", num: stats.electroculus_number },
      { lable: "岩神瞳", num: stats.geoculus_number },
      { lable: "风神瞳", num: stats.anemoculus_number },
      { lable: "秘境", num: stats.domain_number },
    ])

    line.push(explor1)
    line.push(explor2.slice(0, 5))

    let avatars = res.avatars
    avatars = avatars.slice(0, 8)

    let element = gsCfg.getdefSet("element", "role")
    for (let i in avatars) {
      if (avatars[i].id == 10000005) {
        avatars[i].name = "空"
      }
      if (avatars[i].id == 10000007) {
        avatars[i].name = "荧"
      }
      avatars[i].element = element[avatars[i].name]
      let char = Character.get(avatars[i].name)
      avatars[i].img = char.imgs?.gacha
    }

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      name: this.e.sender.card.replace(this.e.uid, "").trim(),
      user_id: this.e.user_id,
      line,
      avatars,
      bg: lodash.random(1, 3),
      ...this.screenData,
    }
  }

  async roleExplore() {
    this.model = "roleExplore"
    let ApiData = {
      index: "",
      basicInfo: "",
    }
    let res = await MysInfo.get(this.e, ApiData)

    if (!res || res[0].retcode !== 0) return false

    let ret = []
    res.forEach(v => ret.push(v.data))

    return this.roleExploreData(ret)
  }

  async roleExploreData(res) {
    let [resIndex, basicInfo] = res

    let stats = resIndex.stats
    let percentage = lodash.round(
      ((stats.precious_chest_number +
        stats.luxurious_chest_number +
        stats.exquisite_chest_number +
        stats.common_chest_number +
        stats.magic_chest_number) *
        100) /
        this.all_chest,
      2,
    )

    let afterPercentage =
      percentage < 60
        ? "D"
        : (percentage < 70 ? "C" : percentage < 80 ? "B" : percentage < 90 ? "A" : "S") +
          `[${percentage}%]`

    let daysDifference =
      Math.floor((new Date() - new Date("2020-09-15")) / (1000 * 60 * 60 * 24)) + 1

    // 顶部三个大数字，不带方块底（对齐米游社个人主页）
    let topLine = [
      { lable: "活跃天数", num: stats.active_day_number, extra: `${daysDifference}` },
      { lable: "深境螺旋", num: stats.spiral_abyss },
      {
        lable: "幻想真境剧诗",
        num: !stats.role_combat.is_unlock
          ? "未解锁"
          : !stats.role_combat.has_detail_data
            ? "-"
            : `第${stats.role_combat.max_round_id}幕${stats.role_combat.tarot_finished_cnt > 0 ? ` 圣牌${stats.role_combat.tarot_finished_cnt}` : ""}`,
      },
    ]

    // 其余全部摊平成一个数组，交给 css grid 四列自动换行，
    // 行数由项数决定，神瞳/新玩法增减都不用改布局
    let items = [
      {
        lable: "幽境危战",
        num: !stats.hard_challenge.is_unlock
          ? "未解锁"
          : !stats.hard_challenge.has_data
            ? "-"
            : ["I", "II", "III", "IV", "V", "VI"][stats.hard_challenge.difficulty - 1],
      },
      { lable: "角色数", num: stats.avatar_number, extra: this.lable.avatar },
      // 默认奇偶男性女性都拿了
      { lable: "满好感角色", num: stats.full_fetter_avatar_num, extra: stats.avatar_number - 3 },
      { lable: "传送点", num: stats.way_point_number, extra: this.lable.way_point },
      { lable: "秘境", num: stats.domain_number, extra: this.lable.domain },
      { lable: "成就", num: stats.achievement_number, extra: this.lable.achievement },
      {
        lable: "宝箱总数",
        num:
          stats.precious_chest_number +
          stats.luxurious_chest_number +
          stats.exquisite_chest_number +
          stats.common_chest_number +
          stats.magic_chest_number,
        extra: this.all_chest,
      },
      {
        lable: "宝箱获取率",
        num: afterPercentage,
        // 深色底，取亮一档的配色保证对比度
        color:
          {
            D: "#3ecfae",
            C: "#4a9ee0",
            B: "#a68fd0",
            A: "#ff7a85",
            S: "#ffa040",
          }[afterPercentage.substr(0, 1)] ?? "",
      },
      { lable: "普通宝箱", num: stats.common_chest_number, extra: this.lable.common_chest },
      { lable: "精致宝箱", num: stats.exquisite_chest_number, extra: this.lable.exquisite_chest },
      { lable: "珍贵宝箱", num: stats.precious_chest_number, extra: this.lable.precious_chest },
      { lable: "华丽宝箱", num: stats.luxurious_chest_number, extra: this.lable.luxurious_chest },
      { lable: "奇馈宝箱", num: stats.magic_chest_number, extra: this.lable.magic_chest },
      ...this.getOculusList(stats),
    ]

    // 尘歌壶
    if (resIndex.homes && resIndex.homes.length > 0) {
      items.push(
        { lable: "家园等级", num: resIndex.homes[0].level },
        { lable: "最高仙力", num: resIndex.homes[0].comfort_num },
        { lable: "洞天名称", num: resIndex.homes[0].comfort_level_name },
        { lable: "获得摆设", num: resIndex.homes[0].item_num },
        { lable: "历史访客", num: resIndex.homes[0].visit_num },
      )
    }

    resIndex.world_explorations = lodash.orderBy(resIndex.world_explorations, ["id"], ["desc"])

    // 父子地区关系、供奉简称、卡片配色都在 defSet/role/index.yaml 里配
    let subArea = this.lable.subArea ?? {}
    let subAreaOnly = this.lable.subAreaOnly ?? []
    let offeringAlias = this.lable.offeringAlias ?? []
    let offeringMax = this.lable.offeringMax ?? 3
    let areaElem = this.lable.areaElem ?? {}
    // 子区域并进父地区，不单独占卡片
    let subIds = lodash.flatten(Object.values(subArea))

    let explor = []
    for (let val of resIndex.world_explorations) {
      if (subIds.includes(val.id)) continue

      val.name = this.areaName[val.id] ?? lodash.truncate(val.name, { length: 6 })

      // 卡片背景优先用米游社官方的地区实景图（bg-地区名.jpg，下载缓存在本地），
      // 没有的地区回退到 miao-plugin 的元素色主题图，两者都没有就走 css 里的深蓝纯色
      let elem = areaElem[val.name] ?? ""
      let bgFile = `${this.screenData.pluResPath}img/other/bg-${val.name}.jpg`
      let bgImg = fs.existsSync(bgFile)
        ? bgFile
        : elem
          ? `${this._path}/plugins/miao-plugin/resources/common/bg/bg-${elem}.webp`
          : ""

      // 本地和接口都没有徽记图时让文字填满卡片，别在左边留一块空白
      let icon = val.icon ?? ""
      let hasIcon =
        icon !== "" || fs.existsSync(`${this.screenData.pluResPath}img/other/${val.name}.png`)
      let tmp = {
        name: val.name,
        bgImg,
        icon,
        hasIcon,
        percent: 0,
        line: [],
      }

      // 只展示子区域的父地区（如沉玉谷），自身百分比无意义
      if (!subAreaOnly.includes(val.id)) {
        tmp.percent = val.exploration_percentage / 10
        tmp.line.push({ name: val.name, text: `${tmp.percent}%` })
      }

      // 七天神像等级（挪德卡莱那边叫新月神像），米游社把它放第一行
      if (val.seven_statue_level > 0) {
        tmp.line.push({ name: "神像", text: `${val.seven_statue_level}级` })
      }

      // 声望：只有 type=Reputation 的地区 level 才是声望等级。
      // type=Offering 时 level 是主供奉等级（如龙脊雪山 12 就是忍冬之树），
      // 那种会和下面的 offerings 重复，所以不单独列
      if (val.type === "Reputation" && val.level > 0) {
        tmp.line.push({ name: "声望", text: `${val.level}级` })
      }

      for (let [i, oid] of (subArea[val.id] ?? []).entries()) {
        let sub = lodash.find(resIndex.world_explorations, o => o.id == oid)
        if (sub) {
          let percent = sub.exploration_percentage / 10
          // 父地区自身不展示探索度时，进度条取第一个子区域的
          if (subAreaOnly.includes(val.id) && i === 0) tmp.percent = percent
          tmp.line.push({
            name: this.areaName[sub.id] ?? lodash.truncate(sub.name, { length: 6 }),
            text: `${percent}%`,
          })
        }
      }

      // 供奉：接口给多少就显示多少，但挪德卡莱有 8 个「聚所」、至冬有 4 项，
      // 全列出来会把卡片撑爆，所以限制条数（米游社 App 里这些也是折叠的）
      for (let offering of (val.offerings ?? []).slice(0, offeringMax)) {
        if (!offering?.name) continue
        // 「空之神殿·摹忆中枢」这类带地区名前缀的去掉前缀，卡片里已经有地区名了
        let name = offering.name.replace(`${val.name}·`, "")
        tmp.line.push({
          name:
            offeringAlias.find(v => name.includes(v)) ??
            lodash.truncate(name, { length: 9, omission: "…" }),
          text: `${offering.level}级`,
        })
      }

      explor.push(tmp)
    }

    let avatar = ""
    if (this.e.member?.getAvatarUrl) {
      avatar = await this.e.member.getAvatarUrl()
    } else if (this.e.friend?.getAvatarUrl) {
      avatar = await this.e.friend.getAvatarUrl()
    } else {
      avatar = resIndex.role.game_head_icon
    }

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      activeDay: this.dayCount(stats.active_day_number),
      topLine,
      items,
      explor,
      basicInfo,
      // 头部名片底图，模板里用 inline style 盖掉 layout 的浅色 .head_box
      bg: lodash.random(1, 8),
      headIndexStyle: this.headIndexStyle,
      ...this.screenData,
      gamename: resIndex?.role?.nickname ?? 0,
      avatar,
      gameavatar: resIndex?.role?.avatar ?? 0,
      gamelevel: resIndex?.role?.level ?? 0,
      gamefwq: resIndex?.role?.region,
    }
  }
}
