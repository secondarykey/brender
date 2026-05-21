import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const LANGUAGES = [
    { code: "ja", label: "日本語" },
    { code: "en", label: "English" },
];

const STORAGE_KEY = "brender-language";

const loadLanguage = async (code) => {
    return await import(`./locale/languages/${code}.json`);
};

const resources = {};
await Promise.all(LANGUAGES.map(async ({ code }) => {
    try {
        const res = await loadLanguage(code);
        resources[code] = { translation: res.default };
    } catch {
        console.warn(`Failed to load language: ${code}`);
    }
}));

const savedLang = localStorage.getItem(STORAGE_KEY) || "ja";

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: savedLang,
        interpolation: {
            escapeValue: false,
        },
    });

i18n.on("languageChanged", (lng) => {
    localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
