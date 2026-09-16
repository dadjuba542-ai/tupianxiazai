import internetarchive from "./internetarchive.js";
import mixkit from "./mixkit.js";
import coverr from "./coverr.js";
import pexels from "./pexels.js";
import pixabay from "./pixabay.js";
import sucai999 from "./sucai999.js";
import xinpianchang from "./xinpianchang.js";
import newcger from "./newcger.js";
import nasa from "./nasa.js";
import youtube from "./youtube.js";

// 源的语言能力：
//   zh   —— 用原始关键词（中文源 / 中英文都能搜的源）
//   en   —— 中文查询时改用英译关键词
//   both —— 中英文各查一次并合并
const LANG = {
  newcger: "zh",
  sucai999: "zh",
  xinpianchang: "zh",
  youtube: "zh",
  nasa: "en",
  mixkit: "en",
  coverr: "en",
  internetarchive: "en",
  pexels: "en",
  pixabay: "both",
};

export const providers = [
  newcger,
  sucai999,
  xinpianchang,
  youtube,
  nasa,
  mixkit,
  coverr,
  internetarchive,
  pexels,
  pixabay,
].map((p) => ({ ...p, lang: LANG[p.id] || "zh" }));

export const providerMap = new Map(providers.map((p) => [p.id, p]));
