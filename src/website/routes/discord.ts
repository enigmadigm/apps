import { AutomoduleData, AutomoduleEndpointData, AutoroleData, AutoroleEndpointData, ChannelData, ClientValuesGuild, CommandsEndpointData, GuildItemSpecial, GuildsEndpointData, HomeEndpointData, LevelsEndpointData, MovementData, MovementEndpointData, PartialGuildObject, RoleData, RoleEndpointData, ServerlogData, ServerlogEndpointData, TwitchEndpointData, WarnConf, WarnConfEndpointData, XClient } from 'src/gm';
import express from 'express';
import { Bot } from '../../bot';
import { addTwitchWebhook } from './twitch';
import { stringToChannel } from '../../utils/parsers';
import { isSnowflake } from '../../utils/specials';
import { Collection, GuildChannel } from 'discord.js';

export function getMutualGuilds(userGuilds: PartialGuildObject[], botGuilds: ClientValuesGuild[]): PartialGuildObject[] {
    return userGuilds.filter(g => {
        return botGuilds.find(g2 => (g.id === g2.id));
    });
}

export function getMutualGuildsWithPerms(userGuilds: PartialGuildObject[], botGuilds: ClientValuesGuild[]): PartialGuildObject[] {
    return userGuilds.filter(g => {
        return botGuilds.find(g2 => (g.id === g2.id) && (g.permissions & 0x20) === 0x20);
    });
}

export function getApplicableGuilds(userGuilds: PartialGuildObject[], botGuilds: ClientValuesGuild[]): {
    excluded: PartialGuildObject[], included: PartialGuildObject[]
} {
    const validGuilds = userGuilds.filter((guild) => (guild.permissions & 0x20) === 0x20);
    const included: PartialGuildObject[] = [];
    const excluded = validGuilds.filter((guild) => {
        const findGuild = botGuilds.find((g) => g.id === guild.id);
        if (!findGuild) return guild;
        included.push(guild);
    });
    return { excluded, included };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const conformsToWarnConf = (o: any): o is WarnConf => {
    return typeof o.threshold === "number" && typeof o.punishment === "string" && typeof o.time === "number";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isStringArray = (o: any[]): o is string[] => {
    return o.every(x => typeof x === "string");
}

export default function routerBuild (client: XClient): express.Router {
    const router = express.Router();

    router.use(express.json());

    // router.use(async (req, res, next) => {
    //     const par = req.params;
    //     console.log(par);
    //     next();
    // });

    // GETters

    router.get('/guilds', async (req, res) => {
        try {
            if (!req.user) {
                return res.sendStatus(401);
            }
            if (!Array.isArray(req.user.guilds)) {
                return res.sendStatus(500);
            }

            const allGuilds = await client.specials.shards.getAllGuilds();
            const { excluded, included } = getApplicableGuilds(req.user.guilds, allGuilds || []);
            const guilds: GuildItemSpecial[] = [
                ...excluded.map((e) => {
                    const g: GuildItemSpecial = {
                        bot: false,
                        icon: e.icon,
                        id: e.id,
                        name: e.name,
                        owner: e.owner,
                        permissions: e.permissions
                    };
                    return g;
                }),
                ...included.map((e) => {
                    const g: GuildItemSpecial = {
                        bot: true,
                        icon: e.icon,
                        id: e.id,
                        name: e.name,
                        owner: e.owner,
                        permissions: e.permissions
                    };
                    return g;
                })
            ].sort((a) => a.bot ? -1 : 1);
            const r: GuildsEndpointData = {
                guilds
            }
            res.send(r);
        } catch (error) {
            xlg.error(error);
            res.sendStatus(500);
        }
    });

    router.get('/guildsall', async (req, res) => {
        try {
            if (!req.user) {
                return res.sendStatus(401);
            }
            if (!Array.isArray(req.user.guilds)) {
                return res.sendStatus(500);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuilds(req.user.guilds, allGuilds ? allGuilds : []);
            res.send({
                guilds: mg,
                user: req.user
            });
        } catch (error) {
            xlg.error(error);
            res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/config", async (req, res) => {
        try {
            const { id } = req.params;
            if (typeof id !== "string" || !isSnowflake(id)) {
                return res.sendStatus(400);
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }
            const g = await client.guilds.fetch(id);
            if (!g) return res.sendStatus(404);
            const prefixesResult = await Bot.client.database.getPrefixes(id);
            const prefix = prefixesResult ? prefixesResult.gprefix || prefixesResult.nprefix : false;
            // if (!prefix) {
            //     const r = await client.database.getGlobalSetting('global_prefix');
            //     prefix = r ? r.value : "sm";
            // }
            if (!prefix || !prefixesResult) {
                return res.status(500).send({ msg: "Unable to retrieve prefix" });
            }
            const modAllRes = await client.database.getGuildSetting(id, 'all_moderation');
            let modAll = false;
            if (modAllRes && modAllRes.value === "enabled") {
                modAll = true;
            }
            res.send({
                id,
                name: g.name,
                prefix,
                icon: g.iconURL(),
                members: g.memberCount,
                moderation: modAll
            });
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/home", async (req, res) => {
        const { id } = req.params;
        if (typeof id !== "string" || !isSnowflake(id)) {
            return res.sendStatus(400);
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }
        const g = await client.guilds.fetch(id);
        if (!g) return res.sendStatus(404);

        try {
            const toSend: HomeEndpointData = {
                guild: {
                    id,
                    name: g.name,
                },
            };
            res.send(toSend);
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/channels", async (req, res) => {
        const { id, text } = req.params;
        if (typeof id !== "string" || !isSnowflake(id)) {
            return res.sendStatus(400);
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }
        const g = await client.guilds.fetch(id);
        if (!g) return res.sendStatus(404);

        const channels = (g.channels.cache.filter(x => x instanceof GuildChannel) as Collection<string, GuildChannel>).map((c) => {
            const data: ChannelData = {
                id: c.id,
                name: c.name,
                type: c.type,
                position: c.rawPosition,
                parentID: c.parentID ?? undefined
            }
            if (c.isText()) {
                data.nsfw = c.nsfw;
                data.topic = c.topic || "";
            }
            return data;
        }).filter(c => text && text === "yes" ? c.type === "text" : true).sort((a, b) => a.position - b.position);

        try {
            res.send({
                id,
                total: channels.length,
                channels
            });
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/roles", async (req, res) => {
        const { id } = req.params;
        if (typeof id !== "string" || !isSnowflake(id)) {
            return res.sendStatus(400);
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }
        const g = await client.guilds.fetch(id);
        if (!g) return res.sendStatus(404);

        const roles = g.roles.cache.filter(r => !r.managed && r.name !== "@everyone").map((c) => {
            const data: RoleData = {
                id: c.id,
                name: c.name,
                position: c.position,
                hexColor: c.hexColor
            }
            return data;
        }).sort((a, b) => b.position - a.position);

        try {
            const toSend: RoleEndpointData = {
                id,
                total: roles.length,
                roles
            };
            res.send(toSend);
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/allautomods", async (req, res) => {
        const { id } = req.params;
        if (typeof id !== "string" || !isSnowflake(id)) {
            return res.sendStatus(400);
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }
        const g = await client.guilds.fetch(id);
        if (!g) return res.sendStatus(404);

        const mods = await client.database.getAllAutoModules(id);
        if (!mods) {
            res.sendStatus(500);
            return;
        }

        /*interface ModData {
            name: string;
            enabled: boolean;
            channels: string[];
        }*/

        try {
            res.send({
                id,
                modules: mods
            });
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/automod/:name", async (req, res) => {
        const { id, name } = req.params;
        if (typeof id !== "string" || !isSnowflake(id) || typeof name !== "string") {
            return res.sendStatus(400);
        }
        const allMods = client.services?.automods || [];
        if (!(allMods.includes(name))) {
            return res.status(400).send("Module does not exist");
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }
        const g = mg.find(x => x.id === id);
        if (!g) return res.sendStatus(404);

        const mod = await client.database.getAutoModule(id, name);
        if (!mod) {
            res.sendStatus(500);
            return;
        }

        try {
            const toSend: AutomoduleEndpointData = {
                id,
                automodule: mod
            }
            res.send(toSend);
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/levels", async (req, res) => {
        const { id } = req.params;
        if (typeof id !== "string" || !isSnowflake(id)) {
            return res.sendStatus(400);
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }
        const g = mg.find(x => x.id === id);
        if (!g) return res.sendStatus(404);

        const levellingEnabled = await client.database.getGuildSetting(g.id, 'xp_levels');
        let enabled = true;
        if (!levellingEnabled || levellingEnabled.value === 'disabled') {
            enabled = false;
        }
        const levelRows = await client.database.getLevelRoles(g.id) || [];

        try {
            const toSend: LevelsEndpointData = {
                id,
                enabled,
                levels: levelRows
            }
            res.send(toSend);
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/autoroles", async (req, res) => {
        const { id } = req.params;
        if (typeof id !== "string" || !isSnowflake(id)) {
            return res.sendStatus(400);
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }
        const g = mg.find(x => x.id === id);
        if (!g) return res.sendStatus(404);

        try {
            const arsRes = await client.database.getGuildSetting(g.id, 'autorole');
            const arDat: AutoroleData = arsRes ? JSON.parse(arsRes.value) : { roles: [], botRoles: [], disabled: true };

            const toSend: AutoroleEndpointData = {
                id,
                data: arDat
            }
            res.send(toSend);
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/warnconf", async (req, res) => {
        try {
            const { id } = req.params;
            if (typeof id !== "string" || !isSnowflake(id)) {
                return res.sendStatus(400);
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }
            const g = mg.find(x => x.id === id);
            if (!g) return res.sendStatus(404);

            const warnConfig = await client.database.getGuildSetting(id, "warnconfig");
            let conf: WarnConf = { punishment: "", threshold: -1, time: 0 };
            try {
                if (warnConfig) {
                    conf = JSON.parse(warnConfig.value);
                }
            } catch (error) {
                //
            }
            if (warnConfig && !conformsToWarnConf(conf)) {
                try {
                    await client.database.editGuildSetting(g, "warnconfig", undefined, true);
                } catch (error) {
                    //
                }
                conf = { punishment: "", threshold: -1, time: 0 };
            }

            try {
                const toSend: WarnConfEndpointData = {
                    id,
                    conf: conf
                }
                res.send(toSend);
            } catch (e) {
                xlg.error(e);
                res.sendStatus(500);
            }
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/serverlog", async (req, res) => {
        try {
            const { id } = req.params;
            if (typeof id !== "string" || !isSnowflake(id)) {
                return res.sendStatus(400);
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }
            const g = mg.find(x => x.id === id);
            if (!g) return res.sendStatus(404);

            const serverLog = await client.database.getGuildSetting(id, "serverlog");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let data: any = {};
            try {
                if (serverLog) {
                    data = JSON.parse(serverLog.value);
                    if (typeof data.events !== "number" || typeof data.ignored_channels !== "object" || typeof data.log_channel !== "string") {
                        await client.database.editGuildSetting(g, "serverlog", undefined, true);
                    }
                }
            } catch (error) {
                //
            }

            try {
                const toSend: ServerlogEndpointData = {
                    log_channel: data.log_channel || "",
                    member_channel: data.member_channel || "",
                    server_channel: data.server_channel || "",
                    voice_channel: data.voice_channel || "",
                    messages_channel: data.messages_channel || "",
                    movement_channel: data.movement_channel || "",
                    ignored_channels: data.ignored_channels || [],
                    events: data.events || 0,
                }
                res.send(toSend);
            } catch (e) {
                xlg.error(e);
                res.sendStatus(500);
            }
        } catch (error) {
            xlg.error(error);
            return res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/twitch", async (req, res) => {
        try {
            const { id } = req.params;
            if (!isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }

            try {
                const subs = await client.database.getTwitchSubsGuild(id);
                if (!subs || !subs.length) {
                    const payload: TwitchEndpointData = [];
                    return res.send(payload);
                }

                const payload: TwitchEndpointData = [];
                for (const sub of subs) {
                    payload.push({
                        channel_id: sub.channelid,
                        streamer_login: sub.streamerlogin,
                        streamer_id: sub.streamerid,
                        message: sub.message || "",
                        delete_after: sub.delafter,
                        notified: sub.notified
                    });
                }

                res.send(payload);
            } catch (e) {
                xlg.error(e);
                res.sendStatus(500);
            }
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/movement", async (req, res) => {
        try {
            const { id } = req.params;
            if (!isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }

            try {
                const g = client.guilds.cache.get(id);//TODO: make this able to work with shards (apply to all uses of this)
                if (!g) return res.sendStatus(404);
                //TODO: it isn't necessary to have two filter calls in this statement, the text channel filter can be applied in the first
                const channels = (g.channels.cache.filter(x => x instanceof GuildChannel) as Collection<string, GuildChannel>).map((c) => {
                    const data: ChannelData = {
                        id: c.id,
                        name: c.name,
                        type: c.type,
                        position: c.rawPosition,
                        parentID: c.parentID ?? undefined
                        //parent: c.parent
                    }
                    if (c.isText()) {
                        data.nsfw = c.nsfw;
                        data.topic = c.topic || "";
                    }
                    return data;
                }).filter(c => c && c.type === "text").sort((a, b) => a.position - b.position);

                const mvm = await client.database.getMovementData(id);

                const toSend: MovementEndpointData = { channels, data: mvm };
                res.send(toSend);
            } catch (e) {
                xlg.error(e);
                res.sendStatus(500);
            }
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.get("/guilds/:id/commands", async (req, res) => {
        try {
            const { id } = req.params;
            if (!isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }

            const g = await client.guilds.fetch(id);//TODO: make this able to work with shards
            if (!g) return res.sendStatus(404);

            const channels = (g.channels.cache.filter(x => x instanceof GuildChannel) as Collection<string, GuildChannel>).map((c) => {
                const data: ChannelData = {
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    position: c.rawPosition,
                    parentID: c.parentID ?? undefined
                }
                if (c.isText()) {
                    data.nsfw = c.nsfw;
                    data.topic = c.topic || "";
                }
                return data;
            }).filter(c => c.type === "text").sort((a, b) => a.position - b.position);

            const roles = g.roles.cache.filter(r => !r.managed && r.name !== "@everyone").map((c) => {
                const data: RoleData = {
                    id: c.id,
                    name: c.name,
                    position: c.rawPosition,
                    hexColor: c.hexColor
                }
                return data;
            }).sort((a, b) => b.position - a.position);

            const cmdconf = await client.database.getCommands(id, true);
            if (!cmdconf || !cmdconf.commands.length) {
                return res.sendStatus(500);
            }

            const modRoleRes = await client.database.getGuildSetting(id, "mod_role");
            const modRole = modRoleRes ? modRoleRes.value : "";

            const toSend: CommandsEndpointData = {
                commands: cmdconf.commands,
                global: cmdconf.conf,
                channels,
                roles,
                mod_role: modRole,
            };
            res.send(toSend);
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    // PUTters

    router.put("/guilds/:id/prefix", async (req, res) => {
        const { prefix } = req.body;
        if (!prefix || typeof prefix !== "string") {
            return res.status(400).send("Bad prefix");
        }
        const { id } = req.params;
        if (typeof id !== "string" || !isSnowflake(id)) {
            return res.status(400).send("Bad id");
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }
        try {
            await client.database.setPrefix(id, prefix);
            res.send({
                guild: {
                    id,
                    prefix
                }
            })
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.put("/guilds/:id/moderation", async (req, res) => {
        const { moderation } = req.body;
        if (!moderation || typeof moderation !== "string" || (moderation !== "true" && moderation !== "false")) {
            return res.status(400).send("Invalid moderation");
        }
        const { id } = req.params;
        if (typeof id !== "string" || !isSnowflake(id)) {
            return res.status(400).send("Bad id");
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }
        try {
            const g = await client.guilds.fetch(id);
            if (moderation === "true") {
                await client.database.editGuildSetting(g, "all_moderation", "enabled");
            } else {
                await client.database.editGuildSetting(g, "all_moderation", undefined, true);
            }
            res.send({
                guild: {
                    id,
                    moderation
                },
                user: req.user,
            });
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.put("/guilds/:id/automod", async (req, res) => {
        const { module, data } = req.body;
        const allMods = client.services?.automods || [];
        if (!module || !data || typeof module !== "string" || !(allMods.includes(module)) || typeof data !== "string") {
            return res.sendStatus(400);
        }
        const { id } = req.params;
        if (typeof id !== "string" || !isSnowflake(id)) {
            return res.status(400).send("Bad id");
        }
        if (!req.user) {
            return res.sendStatus(401);
        }
        const allGuilds = await client.specials.shards.getAllGuilds();
        const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
        if (!mg.find(x => x.id && x.id === id)) {
            return res.sendStatus(401);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conformsToAutomodule = (o: any): o is AutomoduleData => {
            return typeof o.name === "string" && typeof o.text === "boolean" && typeof o.enableAll === "boolean";
        }

        let parsedData: AutomoduleData;
        try {
            parsedData = JSON.parse(data);
            if (!conformsToAutomodule(parsedData)) {
                return res.sendStatus(400);
            }
        } catch (error) {
            return res.sendStatus(400);
        }

        try {
            const g = await client.guilds.fetch(id);
            const result = await client.database.editGuildSetting(g, `automod_${module}`, JSON.stringify(parsedData).escapeSpecialChars());
            if (!result || !result.affectedRows) {
                return res.sendStatus(500);
            }
            res.send({
                guild: {
                    id,
                    module
                },
                user: req.user,
            });
        } catch (e) {
            xlg.error(e);
            res.sendStatus(500);
        }
    });

    router.put("/guilds/:id/warnconf", async (req, res) => {
        try {
            const { data } = req.body;
            if (!module || !data || typeof data !== "string") {
                return res.sendStatus(400);
            }
            const { id } = req.params;
            if (typeof id !== "string" || !isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }

            let parsedData: WarnConf;
            try {
                parsedData = JSON.parse(data);
                if (!conformsToWarnConf(parsedData)) {
                    return res.sendStatus(400);
                }
            } catch (error) {
                return res.sendStatus(400);
            }

            try {
                const g = await client.guilds.fetch(id);
                const result = await client.database.editGuildSetting(g, `warnconfig`, JSON.stringify(parsedData).escapeSpecialChars());
                if (!result || !result.affectedRows) {
                    return res.sendStatus(500);
                }
                res.send({
                    guild: {
                        id,
                        data: parsedData
                    },
                });
            } catch (e) {
                xlg.error(e);
                res.sendStatus(500);
            }
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.put("/guilds/:id/autorole", async (req, res) => {
        try {
            const { data } = req.body;
            if (!module || !data || typeof data !== "string") {
                return res.sendStatus(400);
            }
            const { id } = req.params;
            if (typeof id !== "string" || !isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const conformsToAR = (o: any): o is AutoroleData => {
                return typeof o.roles === "object" && typeof o.botRoles === "object";
            }

            let parsedData;
            try {
                parsedData = JSON.parse(data);
                if (!conformsToAR(parsedData)) {
                    return res.sendStatus(400);
                }
            } catch (error) {
                return res.sendStatus(400);
            }

            try {
                const g = await client.guilds.fetch(id);
                const result = await client.database.editGuildSetting(g, `autorole`, JSON.stringify(parsedData).escapeSpecialChars());
                if (!result || !result.affectedRows) {
                    return res.sendStatus(500);
                }
                res.send({
                    guild: {
                        id,
                        data: parsedData
                    },
                });
            } catch (e) {
                xlg.error(e);
                res.sendStatus(500);
            }
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.put("/guilds/:id/serverlog", async (req, res) => {
        try {
            const { data } = req.body;
            if (!data || typeof data !== "string") {
                return res.sendStatus(400);
            }
            const { id } = req.params;
            if (!isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const conformsToSL = (o: any): o is ServerlogData => {
                return typeof o.events === "number" && typeof o.log_channel === "string";
            }

            let parsedData;
            try {
                parsedData = JSON.parse(data);
                if (!conformsToSL(parsedData)) {
                    return res.sendStatus(400);
                }
            } catch (error) {
                return res.sendStatus(400);
            }

            try {
                const g = await client.guilds.fetch(id);
                const result = await client.database.editGuildSetting(g, `serverlog`, JSON.stringify(parsedData).escapeSpecialChars());
                if (!result || !result.affectedRows) {
                    return res.sendStatus(500);
                }
                res.send({
                    guild: {
                        id,
                        data: parsedData
                    },
                });
            } catch (e) {
                xlg.error(e);
                res.sendStatus(500);
            }
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.delete("/guilds/:id/twitch/:channel", async (req, res) => {
        try {
            const { id, channel } = req.params;
            if (!isSnowflake(id) || !channel) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }

            try {
                const result = await client.database.removeTwitchSubscription(channel, id);
                if (!result) {
                    return res.status(400).send({
                        success: false
                    });
                }
                res.send({
                    success: true
                });
            } catch (e) {
                xlg.error(e);
                res.sendStatus(500);
            }
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.put("/guilds/:id/twitch", async (req, res) => {
        try {
            const { sid, login, cid, message, delafter } = req.body;
            if (typeof sid !== "string" || typeof login !== "string" || typeof cid !== "string" || typeof delafter !== "string" || !/^(-|\+)?[0-9]+$/g.test(delafter)) {
                return res.sendStatus(400);
            }
            const da = parseInt(delafter, 10);
            const msg = typeof message !== "string" ? undefined : message;
            const { id } = req.params;
            if (!isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            if (!mg.find(x => x.id && x.id === id)) {
                return res.sendStatus(401);
            }

            const g = await client.guilds.fetch(id);
            const c = stringToChannel(g, cid, false, false);
            if (!c) {
                return res.status(400).send({
                    error: 'BAD_ID',
                });
            }
            const result = await addTwitchWebhook(sid, true, id, c, msg, true, isNaN(da) ? undefined : da);
            if (result === true) {
                return res.send({
                    success: true
                });
            }
            if (!result) {
                return res.status(400).send({
                    error: 'UNKNOWN',
                });
            }
            return res.status(400).send({
                error: result,
            });
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.put("/guilds/:id/movement", async (req, res) => {
        try {
            const { add_channel, depart_channel, add_message, dm_message, depart_message } = req.body;
            if (typeof add_channel !== "string" ||
                typeof depart_channel !== "string") {
                return res.sendStatus(400);
            }
            const { id } = req.params;
            if (!isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            const g = mg.find(x => x.id && x.id === id);
            if (!g) {
                return res.sendStatus(401);
            }

            // const parsed = JSON.parse(data);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            // const conformsToMvm = (o: any): o is MovementData => {
            //     return typeof o === "object" && !!o && typeof o.dm_channel === "string" && typeof o.add_channel === "string" && typeof o.depart_channel === "string" && 'add_message' in o && 'dm_message' in o && 'depart_message' in o;
            // }

            // if (!conformsToMvm(parsed)) {
            //     return res.sendStatus(400);
            // }

            const data: MovementData = {
                add_channel,
                depart_channel,
                add_message,
                dm_message,
                depart_message,
            };

            // store the data however it will be stored
            const r = await client.database.editGuildSetting(g, "movement", JSON.stringify(data).escapeSpecialChars());
            if (r && r.affectedRows) {
                return res.sendStatus(200);
            }

            return res.sendStatus(400);
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.patch("/guilds/:id/commands", async (req, res) => {
        try {
            const { apply, enabled, channel_mode, channels, role_mode, roles, description_edited, cooldown, exp_level, level, overwites_ignore, delete_overwrites, respond, perm_notif} = req.body;
            // these type checks used to be one big if block, but it was harder to read
            if ((!Array.isArray(apply) || !isStringArray(apply)) ||
                (typeof enabled !== "boolean") ||
                (typeof level !== "undefined" && typeof level !== "number") ||
                (typeof delete_overwrites !== "undefined" && typeof delete_overwrites !== "boolean") || 
                (typeof respond !== "undefined" && typeof respond !== "boolean") || 
                (typeof perm_notif !== "undefined" && typeof perm_notif !== "boolean") || 
                (typeof channel_mode !== "undefined" && typeof channel_mode !== "boolean") || 
                (typeof role_mode !== "undefined" && typeof role_mode !== "boolean") ||
                (typeof channels !== "undefined" && (!Array.isArray(channels) || !isStringArray(channels))) ||
                (typeof roles !== "undefined" && (!Array.isArray(roles) || !isStringArray(roles))) ||
                (typeof description_edited !== "undefined" && typeof description_edited !== "string") ||
                (typeof cooldown !== "undefined" && typeof cooldown !== "number") ||
                (typeof exp_level !== "undefined" && typeof exp_level !== "number") ||
                (typeof overwites_ignore !== "undefined" && (!Array.isArray(overwites_ignore) || !isStringArray(overwites_ignore)))) {
                return res.sendStatus(400);
            }

            const { id } = req.params;
            if (!isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            const g = mg.find(x => x.id && x.id === id);
            if (!g) {
                return res.sendStatus(401);
            }

            const conf = apply.length ? await client.database.getCommands(id, true) : await client.database.getCommands(id, true, false);
            if (!conf) {// if the command settings could not be retrieved
                return res.sendStatus(500);
            }
            if (apply.length) {
                const applyTo = conf.commands.filter(x => apply.includes(x.name) && x.category !== "owner");

                if (delete_overwrites) {
                    const r = await client.database.editCommands(id, applyTo, true);
                    if (r) {
                        return res.sendStatus(200);
                    }
                } else {
                    const changes = applyTo.map(c => {
                        // enabled
                        if (enabled) {
                            c.enabled = true;
                        } else {
                            c.enabled = false;
                        }
                        // c mode
                        if (typeof channel_mode === "boolean") {
                            if (channel_mode) {
                                c.channel_mode = true;
                            } else {
                                c.channel_mode = false;
                            }
                        }
                        // c
                        if (channels) {
                            c.channels = channels;
                        }
                        // r mode
                        if (typeof role_mode === "boolean") {
                            if (role_mode) {
                                c.role_mode = true;
                            } else {
                                c.role_mode = false;
                            }
                        }
                        // r
                        if (roles) {
                            c.roles = roles;
                        }
                        // desc
                        if (typeof description_edited === "string") {
                            c.description_edited = description_edited;
                        }
                        // cooldown
                        if (typeof cooldown === "number" && cooldown >= c.default_cooldown) {
                            c.cooldown = cooldown;
                        }
                        // exp_level
                        if (exp_level) {
                            c.exp_level = exp_level;
                        }
                        // level
                        if (typeof level === "number" && level >= 0) {
                            c.level = level;
                        }
                        return c;
                    });

                    const r = await client.database.editCommands(id, changes);
                    if (r) {
                        return res.sendStatus(200);
                    }
                }
            } else {
                const glob = conf.conf;
                // c mode
                if (typeof channel_mode === "boolean") {
                    if (channel_mode) {
                        glob.channel_mode = true;
                    } else {
                        glob.channel_mode = false;
                    }
                }
                // c
                if (channels) {
                    glob.channels = channels;
                }
                // r mode
                if (typeof role_mode === "boolean") {
                    if (channel_mode) {
                        glob.role_mode = true;
                    } else {
                        glob.role_mode = false;
                    }
                }
                // r
                if (roles) {
                    glob.roles = roles;
                }
                // overwrites_ignore
                if (overwites_ignore) {
                    glob.overwites_ignore = overwites_ignore;
                }
                if (typeof respond === "boolean") {
                    glob.respond = respond;
                }
                if (typeof perm_notif === "boolean") {
                    glob.perm_notif = perm_notif;
                }

                // const r = await client.database.editGuildSetting(id, "commandconf", JSON.stringify(conf));
                const r = await client.database.editCommands(id, conf.commands, false, glob);
                if (r) {
                    return res.sendStatus(200);
                }
            }

            return res.sendStatus(500);
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    router.put("/guilds/:id/modrole", async (req, res) => {
        try {
            const { role } = req.body;
            // these type checks used to be one big if block, but it was harder to read
            if (typeof role !== "string" || (role.length && !/^[0-9]{18}$/g.test(role))) {
                return res.sendStatus(400);
            }

            const { id } = req.params;
            if (!isSnowflake(id)) {
                return res.status(400).send("Bad id");
            }
            if (!req.user) {
                return res.sendStatus(401);
            }
            const allGuilds = await client.specials.shards.getAllGuilds();
            const mg = getMutualGuildsWithPerms(req.user.guilds, allGuilds ? allGuilds : []);
            const g = mg.find(x => x.id && x.id === id);
            if (!g) {
                return res.sendStatus(401);
            }

            const r = await client.database.editGuildSetting(id, "mod_role", role);
            if (r.affectedRows) {
                return res.sendStatus(200);
            }

            return res.sendStatus(500);
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });

    return router;
}
