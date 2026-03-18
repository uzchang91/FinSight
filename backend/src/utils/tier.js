function getTierKeyByIsr(isrScore) {
  const isr = Number(isrScore || 0);

  if (isr >= 90) return "diamond";
  if (isr >= 70) return "gold";
  if (isr >= 50) return "silver";
  return "bronze";
}

function getTierLabelByIsr(isrScore) {
  const isr = Number(isrScore || 0);

  if (isr >= 90) return "다이아";
  if (isr >= 70) return "골드";
  if (isr >= 50) return "실버";
  return "브론즈";
}

module.exports = {
  getTierKeyByIsr,
  getTierLabelByIsr,
};