// 球衣颜色：球员圆点、号码、描边和轨迹线分别用什么颜色。

export const JERSEYS = {
  红: { fill: "#e53935", text: "#ffffff", outline: "#ffffff", trail: "#7f0000" },
  蓝: { fill: "#1e88e5", text: "#ffffff", outline: "#ffffff", trail: "#0d1b7a" },
  白: { fill: "#f5f5f5", text: "#222222", outline: "#222222", trail: "#6d6d6d" },
  黑: { fill: "#212121", text: "#ffffff", outline: "#ffffff", trail: "#000000" },
  黄: { fill: "#fdd835", text: "#222222", outline: "#222222", trail: "#8a6d00" },
  橙: { fill: "#fb8c00", text: "#ffffff", outline: "#ffffff", trail: "#a84300" },
  紫: { fill: "#8e24aa", text: "#ffffff", outline: "#ffffff", trail: "#4a0e5c" },
  天蓝: { fill: "#81d4fa", text: "#222222", outline: "#222222", trail: "#01579b" },
};

export const DEFAULT_HOME = "红";
export const DEFAULT_AWAY = "蓝";
export const NEUTRAL_TRAIL = "#222222"; // 还没有球队控球时的轨迹颜色
