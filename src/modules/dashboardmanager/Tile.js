"use strict";
const sha256 = require("sha256");
const Authentication = require("./../authentication/Authentication");

const TILE_INFO_ONE_TEXT = "InfoOneText"; // One icon, one text, no action
const TILE_INFO_TWO_TEXT = "InfoTwoText"; // One icon, two text, no action
const TILE_INFO_TWO_ICONS = "InfoTwoIcon"; // Two icons, one text, one color, no action
const TILE_ACTION_ONE_ICON = "ActionOneIcon"; // One icon, one action, one color (action auto mapping off)
const TILE_PICTURE_TEXT = "PictureText"; // Background image with a text
const TILE_PICTURES = "PicturesIcon"; // Multiple pictures with an icon
const TILE_GENERIC_ACTION = "GenericAction"; // Extended from ActionOneIcon (action auto mapping on)
const TILE_GENERIC_ACTION_DARK = "GenericActionDark"; // Extended from ActionOneIcon (action auto mapping on)
const TILE_GENERIC_ACTION_STATUS = "GenericActionWithStatus"; // One icon, one action, one color, and a status (red / green btn)
const TILE_DEVICE = "Device"; // One icon, one text, device subinfo items
const TILE_SHUTTER = "Shutter"; // One icon, one text, device subinfo items
const TILE_SUB_TILES = "SubTiles"; // Multiple sub tiles


/**
 * This class describes tiles
 *
 * @class
 */
class Tile {
    /**
     * Constructor
     *
     * @param  {ThemeManager} themeManager              The theme manager
     * @param  {string} identifier                The tile identifier (must be unique)
     * @param  {string} [type=TILE_INFO_ONE_TEXT] The tile's model (or type). Check enum.
     * @param  {string} [icon=null]               The icon
     * @param  {string} [subIcon=null]            The subicon
     * @param  {string} [text=null]               The text
     * @param  {string} [subText=null]            The sub text
     * @param  {string} [picture=null]            A picture in base64 format
     * @param  {Array} [pictures=null]            A list of Base64 pictures
     * @param  {number} [status=0]                A status (0, 1, ...)
     * @param  {number} [order=1]                 A number that represents the place of the tile. 1 is on top, 999999 is on bottom :)
     * @param  {string} [action=null]             The action (route endpoint without `:`)
     * @param  {object} [object=null]             An object
     * @param  {number} [authentication=Authentication.AUTH_USAGE_LEVEL]             The authentication level
     * @returns {Tile}                             A tile
     */
    constructor(themeManager, identifier, type = TILE_INFO_ONE_TEXT, icon = null, subIcon = null, text = null, subText = null, picture = null, pictures = null, status = 0, order = 1, action = null, object = null, authentication = Authentication.AUTH_USAGE_LEVEL) {
        this.themeManager = themeManager;
        this.identifier = identifier.toString();
        this.type = type;
        this.icon = icon;
        this.subicon = subIcon;
        this.text = text?text.toString():null;
        this.subtext = subText?subText.toString():null;
        this.picture = picture;
        this.pictures = pictures;
        this.status = status;
        this.order = order;
        this.action = action;
        this.object = object;
        this.colors = {};
        this.themeManager = themeManager;
        this.customize();
        if (this.action && this.action.substr(0, 1) === "/") {
            this.action = this.action.substr(1, this.action.length - 1);
        }
        this.authentication = authentication;
    }

    /**
     * Get the tile without useless informations
     *
     * @returns {object} A tile ready to be serialized
     */
    get() {
        const tmpTile = Object.assign({}, this);
        delete tmpTile.themeManager;
        return tmpTile;
    }

    /**
     * Customize theme
     *
     * @param  {string} [username=null] A username
     */
    customize(username = null) {
        this.themeColors = this.themeManager.getColors(username);
        delete this.themeColors.icons;
        if (this.type === TILE_INFO_ONE_TEXT || this.type === TILE_INFO_TWO_TEXT || this.type === TILE_INFO_TWO_ICONS || this.type === TILE_PICTURES) {
            this.colors.colorDefault = this.themeManager.getColors(username).secondaryColor;
            this.colors.colorContent = this.themeManager.getColors(username).clearColor;
        } else if (this.type === TILE_ACTION_ONE_ICON || this.type === TILE_GENERIC_ACTION) {
            this.colors.colorDefault = this.themeManager.getColors(username).primaryColor;
            this.colors.colorContent = this.themeManager.getColors(username).clearColor;
        } else if (this.type === TILE_GENERIC_ACTION_DARK) {
            this.colors.colorDefault = this.themeManager.getColors(username).darkenColor;
            this.colors.colorContent = this.themeManager.getColors(username).clearColor;
        } else if (this.type === TILE_PICTURE_TEXT) {
            this.colors.colorContent = this.themeManager.getColors(username).clearColor;
        } else if (this.type === TILE_GENERIC_ACTION_STATUS || this.type === TILE_DEVICE) {
            this.colors.colorDefault = this.themeManager.getColors(username).primaryColor;
            this.colors.colorContent = this.themeManager.getColors(username).clearColor;
            this.colors.colorOn = this.themeManager.getColors(username).onColor;
            this.colors.colorOff = this.themeManager.getColors(username).offColor;
        } else if (this.type === TILE_SUB_TILES) {
            if (Array.isArray(this.object) || (this.object && this.object.miniTiles && Array.isArray(this.object.miniTiles))) {
                let subTiles = this.object;
                if (this.object.miniTiles) subTiles = this.object.miniTiles;
                for (let i = 0 ; i < subTiles.length ; i++) {
                    if (!subTiles[i].colorDefault) {
                        subTiles[i].colorDefault = this.themeManager.getColors(username).primaryColor;
                    } else if (this.themeManager.getColors(username)[subTiles[i].colorDefault]){
                        subTiles[i].colorDefault = this.themeManager.getColors(username)[subTiles[i].colorDefault];
                    }

                    if (!subTiles[i].colorContent) {
                        subTiles[i].colorContent = this.themeManager.getColors(username).clearColor;
                    } else if (this.themeManager.getColors(username)[subTiles[i].colorContent]) {
                        subTiles[i].colorContent = this.themeManager.getColors(username)[subTiles[i].colorContent];
                    }

                    if (i === (subTiles.length - 1)) { // Give last color
                        this.colors.colorDefault = subTiles[i].colorDefault;
                    }
                }
            }
        }
    }

    /**
     * Get the hash value of the tile
     *
     * @returns {string} The object hash
     */
    hash() {
        return sha256((this.identifier?this.identifier.toString():"")
        + (this.icon?this.icon.toString():"")
        + (this.subicon?this.subicon.toString():"")
        + (this.text?this.text.toString():"")
        + (this.subtext?this.subtext.toString():"")
        + (this.picture?this.picture.toString():"")
        + (this.pictures?JSON.stringify(this.pictures):"")
        + (this.object?JSON.stringify(this.object):"")
        + (this.status?this.status.toString():"")
        );
    }

    /**
     * Apply light mode : remove image, ...
     *
     * @param  {string} [username=null] A username
     * @param  {boolean} [lightMode=false]                Light mode
     */
    applyMode(username = null, lightMode = false) {
        if (lightMode) {
            this.picture = null;
            this.pictures = [];
        }

        if (this.colors.colorDefault == this.themeManager.getColors(username).secondaryColor && this.picture) {
            this.colors.colorDefault = this.themeManager.getColors(username).darkenColor;
        }
    }
}

module.exports = {class:Tile,
    TILE_INFO_ONE_TEXT:TILE_INFO_ONE_TEXT,
    TILE_INFO_TWO_TEXT:TILE_INFO_TWO_TEXT,
    TILE_INFO_TWO_ICONS:TILE_INFO_TWO_ICONS,
    TILE_ACTION_ONE_ICON:TILE_ACTION_ONE_ICON,
    TILE_PICTURE_TEXT:TILE_PICTURE_TEXT,
    TILE_PICTURES:TILE_PICTURES,
    TILE_GENERIC_ACTION:TILE_GENERIC_ACTION,
    TILE_GENERIC_ACTION_DARK:TILE_GENERIC_ACTION_DARK,
    TILE_GENERIC_ACTION_STATUS:TILE_GENERIC_ACTION_STATUS,
    TILE_DEVICE:TILE_DEVICE,
    TILE_SUB_TILES:TILE_SUB_TILES,
    TILE_SHUTTER:TILE_SHUTTER
};
