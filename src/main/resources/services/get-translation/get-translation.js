const Content = require('/lib/xp/content')
const Context = require('/lib/xp/context')

const Google = require('/lib/modules/google')
const Util = require('/lib/modules/util')

const AutomaticTranslationConfig = require('/lib/modules/automatic-translation/config')
const Translate = require('/lib/modules/automatic-translation/translate')

exports.post = function(req) {
    const reqBody = Util.parseJSON(req.body)
    const contentId = req.params.contentId
    const auto = reqBody.auto

    const siteConfig = Util.getAppConfig(contentId) || {}

    const apiInfo = {
        authKey: siteConfig.google_api_key || '',
        sourceLanguage: siteConfig.google_api_source_language || '',
        targetLanguage: siteConfig.google_api_target_language || ''
    }

    if (auto) {
        if (!contentId) {
            return {
                status: 400
            }
        }

        const content = Content.get({ key: contentId })
        const currentSite = content && Content.getSite({ key: content._path })
        const context = Context.get()
        const iataConfig = currentSite && AutomaticTranslationConfig.getConfig(currentSite._id, context.repository.replace('com.enonic.cms.', ''))

        Translate.autoTranslate(contentId, apiInfo, iataConfig)

        return {
            status: 200
        }
    } else {
        const translated = Google.getTranslation(reqBody.text, apiInfo)

        return {
            contentType: 'application/json',
            body: {
                text: translated
            }
        }
    }
}
