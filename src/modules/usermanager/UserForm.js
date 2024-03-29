var FormObject = require("./../formmanager/FormObject");

/**
 * This class provides a form for one user
 *
 * @class
 */
class UserForm extends FormObject.class {
    /**
     * Constructor
     *
     * @param  {number} [id=null]                  An identifier
     * @param  {string} [username=null] Username
     * @param  {string} [password=null] Password
     * @param  {int} [level=null] Authorization level
     * @param  {string} [name=null] Full name
     * @param  {string} [picture=null]  Picture, in base64 format
     * @param  {boolean} [atHome=false]  True if user is at home, false otherwise
     * @param  {string} [theme=null]  Theme, in base64 format
     * @returns {UserForm} The instance
     */
    constructor(id = null, username = null, password = null, level = null, name = null, picture = null, atHome = false, theme = null) {
        super(id);

        /**
         * @Property("username");
         * @Title("user.form.username");
         * @Type("string");
         * @Required(true);
         */
        this.username = username;

        /**
         * @Property("password");
         * @Title("user.form.password");
         * @Type("string");
         * @Required(true);
         * @Display("password");
         */
        this.password = password;

        /**
         * @Property("level");
         * @Title("user.form.level");
         * @Type("number");
         * @EnumNames(["user.form.level.disabled", "user.form.level.guest", "user.form.level.tablet", "user.form.level.standard", "user.form.level.admin", "user.form.level.dev"]);
         * @Enum([0, 7, 20, 10, 80, 90]);
         * @Required(true);
         */
        this.level = level;

        /**
         * @Property("name");
         * @Title("user.form.fullname");
         * @Type("string");
         * @Required(true);
         */
        this.name = name;

        /**
         * @Property("picture");
         * @Title("user.form.picture");
         * @Type("file");
         */
        this.picture = picture;

        /**
         * @Property("atHome");
         * @Title("user.form.atHome");
         * @Type("boolean");
         * @Display("hidden");
         * @Default(false);
         */
        this.atHome = atHome;

        /**
         * @Property("theme");
         * @Title("user.form.theme");
         * @Type("file");
         */
        this.theme = theme;
    }

    /**
     * Convert json data
     *
     * @param  {object} data Some key / value data
     * @returns {UserForm}      A form object
     */
    json(data) {
        return new UserForm(data.id, data.username, data.password, data.level, data.name, data.picture, data.atHome, data.theme);
    }
}

module.exports = {class:UserForm};
