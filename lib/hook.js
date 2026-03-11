class Hook {
    constructor({ name, description, event, action }) {
        this.name = name; // name of event
        this.description = description; // description of event
        this.event = event; // event type
        this.action = action; // callback function to execute when event is triggered
    }
}
module.exports = Hook;