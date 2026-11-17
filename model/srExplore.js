import fs from "node:fs"
import base from "./base.js"
import MysInfo from "./mys/mysInfo.js"

const regionName = {
  prod_gf_cn: "星穹列车",
  prod_qd_cn: "星穹列车",
  prod_official_usa: "美服",
  prod_official_euro: "欧服",
  prod_official_asia: "亚服",
  prod_official_cht: "港澳台服",
}

const progress = (current, total) =>
  Number(total) > 0 ? Math.min(100, Math.max(0, Number(current) / Number(total) * 100)) : 0

export default class SrExplore extends base {
  static async get(e) {
    return await new SrExplore(e).getExplore()
  }

  async getExplore() {
    const res = await MysInfo.get(this.e, {
      index: "",
      basicInfo: "",
      chestInfo: "",
      achievementInfo: "",
    })
    if (!res || res.some(v => v?.retcode !== 0)) return false
    const data = Object.fromEntries(res.map(v => [v.api, v.data]))
    return this.dealData(data.index, data.basicInfo, data.chestInfo, data.achievementInfo)
  }

  dealData(index, basic, chestInfo, achievementInfo) {
    const stats = index.stats
    const worlds = chestInfo.world_list || []
    const series = achievementInfo.list || []
    const achievementTotal = series.reduce((sum, item) => sum + Number(item.max), 0)
    const chestCurrent = worlds.reduce((sum, world) => sum + Number(world.world_cur), 0)
    const chestTotal = worlds.reduce((sum, world) => sum + Number(world.world_max), 0)
    const items = [
      { lable: "达成成就", num: stats.achievement_num, extra: series.length ? achievementTotal : undefined },
      { lable: "金杯成就", num: achievementInfo.gold_num ?? "-" },
      { lable: "银杯成就", num: achievementInfo.silver_num ?? "-" },
      { lable: "铜杯成就", num: achievementInfo.copper_num ?? "-" },
    ]
    if (worlds.length) {
      items.push(
        { lable: "地图战利品", num: chestCurrent, extra: chestTotal },
        { lable: "待开启战利品", num: Math.max(0, chestTotal - chestCurrent) },
      )
    }
    if (stats.dream_paster_num != null) items.push({ lable: "梦境护照", num: stats.dream_paster_num })
    if (stats.pet_num != null) items.push({ lable: "已结识伙伴", num: stats.pet_num })

    return {
      ...this.screenData,
      pluResPath: `${this._path}/plugins/genshin/resources/`,
      saveId: `sr-${this.e.uid}`,
      uid: this.e.uid,
      gamename: basic.nickname || `UID${this.e.uid}`,
      avatar: basic.avatar || index.cur_head_icon_url || "",
      gamelevel: basic.level ?? "-",
      gamefwq: regionName[basic.region] || basic.region || "星穹列车",
      bg: 1,
      topLine: [
        { lable: "活跃天数", num: stats.active_days ?? "-" },
        { lable: "已解锁角色", num: stats.avatar_num ?? "-" },
        { lable: "累计战利品", num: stats.chest_num ?? "-" },
      ],
      items,
      basicInfo: null,
      explorGroups: [
        {
          title: "战利品开启详情",
          list: worlds.map(world => {
            const bgFile = `${this._path}/plugins/genshin/resources/StarRail/img/explore/${Number(world.world_id)}.jpg`
            return {
              name: world.name,
              header: world.name,
              summary: `${world.world_cur}/${world.world_max}`,
              icon: world.icon,
              bgImg: fs.existsSync(bgFile) ? bgFile : `${this._path}/plugins/genshin/resources/StarRail/img/worldcard/星穹列车.png`,
              percent: progress(world.world_cur, world.world_max),
              line: (world.map_entrances || []).map(map => ({
                name: map.name,
                text: `${map.cur_chest}/${map.max_chest}`,
                color: Number(map.cur_chest) < Number(map.max_chest) ? "#efdfb9" : "",
              })),
            }
          }),
        },
        {
          title: "成就详情",
          list: series.map(item => ({
            name: item.name,
            header: item.name,
            icon: item.icon,
            percent: progress(item.cur, item.max),
            line: [{ name: "达成成就", text: `${item.cur}/${item.max}` }],
          })),
        },
      ],
    }
  }
}
