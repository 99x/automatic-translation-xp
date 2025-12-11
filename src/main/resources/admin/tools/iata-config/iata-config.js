const Thymeleaf = require('/lib/thymeleaf')
const App = require('/lib/xp/app')
const Project = require('/lib/xp/project')
const Context = require('/lib/xp/context')
const Content = require('/lib/xp/content')
const Portal = require('/lib/xp/portal')

const AutomaticTranslationConfig = require('/lib/modules/automatic-translation/config')

exports.get = () => {
    const view = resolve('iata-config.html')

    const sites = AutomaticTranslationConfig.getSites()

    const model = {
        sites,
        services: {
            manageConfig: Portal.serviceUrl({ service: 'manage-config', type: 'absolute' })
        }
    }
    return {
        body: Thymeleaf.render(view, model)
    }
}
