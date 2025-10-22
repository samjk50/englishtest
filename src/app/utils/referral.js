// utils/referral.ts
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateAgentCode(prefix = "AGENT", len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ALNUM[Math.floor(Math.random() * ALNUM.length)];
  }
  return (prefix + s).toUpperCase();
}
