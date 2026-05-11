import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const loadLanguage = async (code) => {
    return await import(`./locale/languages/${code}.json`);
}

const createLanguages = async () => {

    var codes = ["en", "ja"];

    var langs = {};

    codes.forEach(code => {
        loadLanguage(code).then(res => {
            langs[code] = { translation: res.default }
        }).catch(() => {
            console.warn(`Failed to load language: ${code}`);
        });
    });

    console.log(langs)

    return langs;
}

const resources = await createLanguages();

i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: "en",
        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;
