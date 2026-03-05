const Task = require('/lib/xp/task')
const Util = require('/lib/modules/util')

exports.post = function(req) {
    const body = Util.parseJSON(req.body) || {}
    const siteId = body.siteId || req.params.siteId
    const repoId = body.repoId || req.params.repoId

    if (!siteId || !repoId) {
        return {
            status: 400,
            contentType: 'application/json',
            body: {
                error: 'siteId and repoId are required'
            }
        }
    }

    const taskId = Task.submitTask({
        descriptor: 'translate-all',
        config: { siteId, repoId }
    })

    return {
        status: 200,
        contentType: 'application/json',
        body: {
            taskId
        }
    }
}
