/**
 * Sayfa içeriğini taşıyan alanın kimliği (__root.tsx → AppChrome).
 *
 * Tarayıcıda ve Android'de bu alan kaymaz, belge kayar. iOS kabuğunda ise
 * belge sabit durur ve KAYAN ALAN budur (styles.css → html[data-ios-shell]).
 * Router yeni sayfaya geçerken bu alanı da başa alır (router.tsx).
 */
export const APP_SCROLL_ID = "app-scroll";
