// 影视/新媒体行业术语词典
// 在线翻译对行业黑话（如「空镜」）翻译很差，这里优先命中
// 需要新增直接往下加即可

export const GLOSSARY = {
  空镜: "stock footage b-roll",
  空镜头: "b-roll footage",
  延时: "time lapse",
  延时摄影: "time lapse",
  缩时: "time lapse",
  混剪: "montage",
  卡点: "beat sync",
  踩点: "beat sync",
  运镜: "camera movement",
  分镜: "storyboard",
  转场: "transition",
  慢动作: "slow motion",
  升格: "slow motion",
  绿幕: "green screen",
  抠像: "green screen keying",
  定格: "freeze frame",
  微距: "macro close up",
  航拍: "aerial drone",
  无人机: "drone aerial",
  科技感: "futuristic technology",
  故障风: "glitch effect",
  赛博朋克: "cyberpunk neon",
  粒子: "particles",
  光效: "light leaks",
  国潮: "chinese traditional style",
  水墨: "ink wash painting",
  烟火气: "daily life street",
  都市感: "urban city",
  大片感: "cinematic",
  治愈系: "healing relax",
  胶片感: "film grain",
  第一视角: "pov first person",
  特写: "close up",
  全景: "panorama wide shot",
  远景: "wide shot",
  逆光: "backlight",
  剪影: "silhouette",
  慢门: "long exposure",
  跟拍: "tracking shot",
  环绕镜头: "orbit shot",
  开场: "opening intro",
  片头: "intro title",
  背景视频: "background video",
  氛围感: "atmospheric mood",
  极简: "minimal",
  手写: "handwriting",
  数据可视化: "data visualization",
  粒子背景: "particle background",
  抽象背景: "abstract background",
  商务: "business corporate",
  办公: "office work",
  城市夜景: "city night view",
  海边: "beach ocean",
  星空: "starry sky",
  日出: "sunrise",
  日落: "sunset",
  森林: "forest",
  下雨: "rain",
  下雪: "snow",
  樱花: "cherry blossom",
  花朵: "flowers",
};

const keys = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

export function lookupGlossary(keyword) {
  const kw = String(keyword || "").trim();
  if (!kw) return "";
  if (GLOSSARY[kw]) return GLOSSARY[kw];
  for (const k of keys) {
    if (kw.includes(k) && k.length >= 2) return GLOSSARY[k];
  }
  return "";
}
