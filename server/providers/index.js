import internetarchive from "./internetarchive.js";
import mixkit from "./mixkit.js";
import coverr from "./coverr.js";
import pexels from "./pexels.js";
import pixabay from "./pixabay.js";
import sucai999 from "./sucai999.js";
import xinpianchang from "./xinpianchang.js";
import newcger from "./newcger.js";
import nasa from "./nasa.js";

export const providers = [
  newcger,
  sucai999,
  xinpianchang,
  nasa,
  mixkit,
  coverr,
  internetarchive,
  pexels,
  pixabay,
];

export const providerMap = new Map(providers.map((p) => [p.id, p]));
