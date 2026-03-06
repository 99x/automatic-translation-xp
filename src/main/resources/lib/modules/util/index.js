const HttpClient = require('/lib/http-client')
const Admin = require('/lib/xp/admin')
const I18n = require('/lib/xp/i18n')
const Content = require('/lib/xp/content')

module.exports = {
    performRequest,
    parseJSON,
    localize,
    isUrlValue,
    isUUIDValue,
    getAppConfig,
    forceArray,
    areNodesInSync
}

function performRequest(request, MAX_RETRY = 3){
    try {
        if (MAX_RETRY === 0){
            return null
        }

        request.connectionTimeout = 60000 // 1 minute
        request.readTimeout = 60000 // 1 minute

        return HttpClient.request(request)
        
    } catch (error){
        return performRequest(request, MAX_RETRY - 1)
    }
}

function parseJSON(json) {
    try {
        return JSON.parse(json)
    } catch(err) {
        return {}
    }
}

function localize(key) {
    const locale = Admin.getLocale()

    return I18n.localize({
        key: key,
        locale: locale
    })
}

function isUrlValue(str) {
    var urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,6})(\/[\w.-]*)*\/?(#[\w.-]*)?$/
    return urlPattern.test(str)
}

function isUUIDValue (str) {
	const regex = new RegExp(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
	return regex.test(str)
}

function getAppConfig(contentId) {
    let siteConfig = (contentId && Content.getSiteConfig({
        key: contentId,
        applicationKey: app.name
    }))

    if (!siteConfig) {
        const sitesQuery = Content.query({
            count: 1,
            contentTypes: [`portal:site`],
            query: `type='portal:site' AND data.siteConfig.applicationKey='${app.name}'`
        })

        if (sitesQuery.total > 0) {
            siteConfig = Content.getSiteConfig({
                key: sitesQuery.hits[0]._id,
                applicationKey: app.name
            })
        }
    }

    return siteConfig
}

function forceArray(data) {
	if (data === null || data === undefined) {
		data = []
	} else if (Object.prototype.toString.call(data) === '[object Arguments]') {
		data = Array.prototype.slice.call(data)
	} else if (!Array.isArray(data)) {
		data = [data]
	}
	return data
}

function areNodesInSync(draftNode, masterNode) {
    if (!draftNode || !masterNode) {
        return false
    }

    const normalizeNodeForComparison = (value) => {
        if (Array.isArray(value)) {
            return value.map(normalizeNodeForComparison)
        }
    
        if (!value || typeof value !== 'object') {
            return value
        }
    
        const normalized = {}
    
        Object.keys(value).sort().forEach((key) => {
            if (key.startsWith('_')) {
                return
            }
    
            normalized[key] = normalizeNodeForComparison(value[key])
        })
    
        return normalized
    }

    return JSON.stringify(normalizeNodeForComparison(draftNode)) === JSON.stringify(normalizeNodeForComparison(masterNode))
}
