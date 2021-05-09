var FormObject = require("./../formmanager/FormObject");

/**
 * This class provides a form for a time trigger event for scenario
 *
 * @class
 */
class TimeScenarioForm extends FormObject.class {
    /**
     * Constructor
     *
     * @param  {number} [id=null]                  An identifier
     * @param  {number} [day=null]                  The day indicator
     * @param  {string} [time=null]                The time
     * @param  {string} [mode=null]                Mode
     * @param  {string} [repeat=null]                Repeat
     * @returns {TimeScenarioForm} The instance
     */
    constructor(id = null, day = null, time = null, mode = null, repeat = null) {
        super(id);
        /**
         * @Property("mode");
         * @Title("time.scenario.form.mode");
         * @Type("string");
         * @Enum(["modeManual", "modeRepeat"]);
         * @EnumNames(["time.scenario.form.mode.manual", "time.scenario.form.mode.repeat"]);
         */
        this.mode = mode;

        /**
         * @Property("day");
         * @Title("time.scenario.form.day");
         * @Type("number");
         * @Enum([1,2,3,4,5,6,0]);
         * @EnumNames(["time.scenario.form.day.monday", "time.scenario.form.day.tuesday", "time.scenario.form.day.wednesday", "time.scenario.form.day.thursday", "time.scenario.form.day.friday", "time.scenario.form.day.saturday", "time.scenario.form.day.sunday"]);
         * @DependencyField("mode");
         * @DependencyValues("modeManual");
         */
        this.day = day;

        /**
         * @Property("time");
         * @Title("time.scenario.form.time");
         * @Type("string");
         * @Regexp("[0-9]{1,2}:[0-9]{1,2}");
         * @DependencyField("mode");
         * @DependencyValues("modeManual");
         */
        this.time = time;

        /**
         * @Property("repeat");
         * @Title("time.scenario.form.mode.repeat");
         * @Type("string");
         * @Enum(["everyMin", "every5Min", "every15Min", "every30Min", "everyHours", "every3Hours", "every6Hours", "every8Hours", "everyDays", "everyMonth"]);
         * @EnumNames(["time.scenario.form.mode.repeat.minutes", "time.scenario.form.mode.repeat.five.minutes", "time.scenario.form.mode.repeat.fifteen.minutes", "time.scenario.form.mode.repeat.thirteen.minutes", "time.scenario.form.mode.repeat.hours", "time.scenario.form.mode.repeat.three.hours", "time.scenario.form.mode.repeat.six.hours", "time.scenario.form.mode.repeat.eight.hours", "time.scenario.form.mode.repeat.days", "time.scenario.form.mode.repeat.month"]);
         * @DependencyField("mode");
         * @DependencyValues("modeRepeat");
         */
        this.repeat = repeat;
    }

    /**
     * Convert json data
     *
     * @param  {object} data Some key / value data
     * @returns {TimeScenarioForm}      A form object
     */
    json(data) {
        return new TimeScenarioForm(data.id, data.day, data.time, data.mode, data.repeat);
    }
}

module.exports = {class:TimeScenarioForm};
