/**
 * Sayfa içeriğini taşıyan alanın kimliği (__root.tsx → AppChrome).
 *
 * Tarayıcıda bu alan kaymaz, belge kayar. iOS ve Android uygulamasında ise
 * belge sabit durur ve KAYAN ALAN budur (styles.css → html[data-native-shell]).
 * Router yeni sayfaya geçerken bu alanı da başa alır (router.tsx).
 */
export const APP_SCROLL_ID = "app-scroll";
