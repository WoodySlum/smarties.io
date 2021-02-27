"use strict";

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * This class manage uptime tile
     *
     * @class
     */
    class Uptime {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The api
         * @returns {HuaweiRouter}     The instance
         */
        constructor(api) {
            const startTime = api.exported.DateUtils.class.timestamp();
            const icon = "<!-- Credits : Pixelmeetup / https://www.flaticon.com/free-icon/uptime_1792280 --><svg height=\"512pt\" viewBox=\"0 0 512 512\" width=\"512pt\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m64 432h16v16h-16zm0 0\"/><path d=\"m96 432h16v16h-16zm0 0\"/><path d=\"m128 432h16v16h-16zm0 0\"/><path d=\"m32 432h16v16h-16zm0 0\"/><path d=\"m64 368h16v16h-16zm0 0\"/><path d=\"m96 368h16v16h-16zm0 0\"/><path d=\"m128 368h16v16h-16zm0 0\"/><path d=\"m32 368h16v16h-16zm0 0\"/><path d=\"m64 304h16v16h-16zm0 0\"/><path d=\"m32 304h16v16h-16zm0 0\"/><path d=\"m96 304h16v16h-16zm0 0\"/><path d=\"m64 240h16v16h-16zm0 0\"/><path d=\"m32 240h16v16h-16zm0 0\"/><path d=\"m64 112h16v16h-16zm0 0\"/><path d=\"m32 112h16v16h-16zm0 0\"/><path d=\"m96 112h16v16h-16zm0 0\"/><path d=\"m128 112h16v16h-16zm0 0\"/><path d=\"m64 176h16v16h-16zm0 0\"/><path d=\"m32 176h16v16h-16zm0 0\"/><path d=\"m96 176h16v16h-16zm0 0\"/><path d=\"m272 128h16v16h-16zm0 0\"/><path d=\"m272 368h16v16h-16zm0 0\"/><path d=\"m152 248h16v16h-16zm0 0\"/><path d=\"m183.839844 171.148438 11.3125-11.3125 11.3125 11.3125-11.3125 11.316406zm0 0\"/><path d=\"m353.546875 340.851562 11.316406-11.3125 11.3125 11.3125-11.3125 11.316407zm0 0\"/><path d=\"m183.835938 340.851562 11.316406-11.3125 11.3125 11.3125-11.3125 11.3125zm0 0\"/><path d=\"m432 130.398438-79.710938 109.601562h39.710938v113.34375c-39.347656 45.679688-102.527344 62.820312-159.566406 43.292969-57.039063-19.527344-96.457032-71.792969-99.554688-132.003907-3.097656-60.207031 30.75-116.242187 85.480469-141.519531 54.734375-25.277343 119.339844-14.710937 163.167969 26.6875l-20 27.496094 12.945312 9.40625 57.527344-79.101563 57.527344 79.101563 12.945312-9.40625-70.472656-96.898437-41 56.402343c-28.152344-26.074219-64.664062-41.28125-103-42.90625v-93.894531h-288v480h288v-59.726562c38.773438-1.75 75.648438-17.269532 104-43.777344v23.503906h80v-160h39.710938zm-416-82.398438h16v-16h-16v-16h256v16h-16v16h16v32h-256zm0 48h237.121094c-16.691406 2.804688-32.84375 8.203125-47.863282 16h-45.257812v16h20.390625c-6.3125 4.894531-12.261719 10.242188-17.796875 16h-146.59375zm0 64h133.152344c-10.84375 14.511719-19.179688 30.738281-24.671875 48h-108.480469zm0 64h104.304688c-2.230469 10.84375-3.351563 21.886719-3.34375 32.960938 0 5.078124.304687 10.078124.800781 15.039062h-101.761719zm0 64h104c3.238281 16.820312 9.125 33.019531 17.433594 48h-121.433594zm0 64h131.679688c14.148437 19.777344 32.507812 36.167969 53.753906 48h-185.433594zm256 112h-256v-48h224v-.800781c10.480469 2.675781 21.199219 4.300781 32 4.847656zm184-240v160h-48v-160h-24.289062l48.289062-66.398438 48.289062 66.398438zm0 0\"/><path d=\"m272 160v99.3125l46.34375 46.34375 11.3125-11.3125-41.65625-41.65625v-92.6875zm0 0\"/><path d=\"m16 496h48v16h-48zm0 0\"/><path d=\"m224 496h48v16h-48zm0 0\"/><path d=\"m160 432h96v16h-96zm0 0\"/><path d=\"m48 32h192v16h-192zm0 0\"/></svg>";
            let tile = api.dashboardAPI.Tile("uptime", api.dashboardAPI.TileType().TILE_INFO_ONE_TEXT, icon, null, api.exported.DateUtils.class.relativeTime(startTime), null, null, null, 0, 999995);
            api.dashboardAPI.registerTile(tile);
            api.timeEventAPI.register(() => {
                tile = api.dashboardAPI.Tile("uptime", api.dashboardAPI.TileType().TILE_INFO_ONE_TEXT, icon, null, api.exported.DateUtils.class.relativeTime(startTime), null, null, null, 0, 999995);
                api.dashboardAPI.registerTile(tile);
            }, this, api.timeEventAPI.constants().EVERY_FIVE_MINUTES);
        }
    }

    api.registerInstance(new Uptime(api));
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "uptime",
    version: "0.0.0",
    category: "misc",
    defaultDisabled: true,
    description: "Uptime tile"
};
