export function buildNormalizationRequesterOptions(users = []) {
  return users
    .filter((user) => (
      user?.isAdmin
      && user?.statusCode === "active"
    ))
    .map((user) => ({
      value: String(user.id || "").trim(),
      label: String(user.person || user.name || user.username || "").trim(),
      hubUserId: user.id,
      username: String(user.username || "").trim(),
      itopPersonKey: String(user.itopPersonKey || "").trim(),
      hasItopPersonLink: /^\d+$/.test(String(user?.itopPersonKey || "").trim()),
    }))
    .filter((option) => option.value && option.label);
}
