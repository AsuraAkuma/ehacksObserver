const { catalog } = require('./lib/achievementsCatalog');
const { checks } = require('./lib/checks');

class PointSettings {
    constructor() {
        this.points = this.buildPointDefinitions();
    }

    buildPointDefinitions() {
        const result = {};
        for (const [category, entries] of Object.entries(catalog)) {
            result[category] = {};
            for (const [key, definition] of Object.entries(entries)) {
                result[category][key] = {
                    description: definition.description,
                    points: definition.points,
                    check: checks[category] && checks[category][key]
                        ? checks[category][key]
                        : () => false,
                };
            }
        }
        return result;
    }
}

module.exports = PointSettings;
