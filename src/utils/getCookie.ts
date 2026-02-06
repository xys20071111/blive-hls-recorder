export function getCookieValue(cookie: string, key: string) {
  const cookies = cookie.split(";").map((value) => {
    return value.trim();
  });
  for (const item of cookies) {
    if (item.startsWith(key)) {
      return item.split("=").pop();
    }
  }
}

if (import.meta.main) {
  console.log(getCookieValue("a=1; b=2", "b"));
}
