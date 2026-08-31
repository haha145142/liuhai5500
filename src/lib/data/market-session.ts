export function isChinaTradingSession(date = new Date()) {
  const cn = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const day = cn.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = cn.getUTCHours() * 60 + cn.getUTCMinutes();
  return (minutes >= 9 * 60 + 30 && minutes < 11 * 60 + 30) || (minutes >= 13 * 60 && minutes < 15 * 60);
}

export function chinaSessionLabel(date = new Date()) {
  const cn = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const day = cn.getUTCDay();
  if (day === 0 || day === 6) return "休市";
  const minutes = cn.getUTCHours() * 60 + cn.getUTCMinutes();
  if (minutes < 9 * 60 + 30) return "未开盘";
  if (minutes < 11 * 60 + 30) return "上午交易";
  if (minutes < 13 * 60) return "午间休市";
  if (minutes < 15 * 60) return "下午交易";
  return "已收盘";
}
