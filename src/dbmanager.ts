import { AutomoduleData, BSRow, CmdConfEntry, CmdTrackingRow, CommandConf, CommandsGlobalConf, DashUserObject, ExpRow, FullPointsData, GlobalSettingRow, GuildSettingsRow, GuildUserDataRow, InsertionResult, InvitedUserData, LevelRolesRow, ModActionData, ModActionEditData, MovementData, PartialGuildObject, PersonalExpRow, StarredMessageData, StoredPresenceData, TimedAction, TimedActionRow, TwitchHookRow, UserDataRow, XClient, XMessage } from "./gm";
import mysql, { escape } from "mysql";
import config, { db_config } from "../auth.json";
import moment from "moment";
import util from 'util';
import Discord, { Guild, GuildMember, PartialGuildMember, Permissions, Role, Snowflake, TextChannel, User } from 'discord.js';
import { Bot } from "./bot";
import uniquid from 'uniqid';
import { permLevels } from "./permissions";
import { isSnowflake, shards } from "./utils/specials";
import Starboard from "./struct/Starboard";

const levelRoles = [
    {
        level: 70,
        name: "Mega Divine Active Member",
        color: 0x9F2292,
    },
    {
        level: 60,
        name: "Active x10⁹⁹",
        color: 0x943246,
    },
    {
        level: 50,
        name: "Super Hyper Active Member",
        color: 0x3F62CC
    },
    {
        level: 40,
        name: "Hyper Active Member",
        color: 0x1F8B4B,
    },
    {
        level: 25,
        name: "Very Active Member",
        color: 0xBA342A,
    },
    {
        level: 10,
        name: "Active Member",
        color: 0xBB3DA8,
    },
    {
        level: 5,
        name: "Not-An-Alt Level",
        color: 0xa886f1,
    },
    {
        level: 1,
        name: "Noob Level",
        color: 0x99AAB1,
    }
];

type TimedActionQuery = Partial<TimedActionRow>/* & */;

// https://www.tutorialkart.com/nodejs/nodejs-mysql-result-object/#Example-Nodejs-MySQL-INSERT-INTO-Result-Object

export class DBManager {
    public db!: mysql.Connection;
    private query!: (arg1: string | mysql.QueryOptions) => Promise<unknown>;
    public connected: boolean;
    private ping!: (arg1: mysql.QueryOptions | undefined) => Promise<void>;

    constructor() {
        // this.db;
        // this.query;
        this.connected = false;
    }

    async handleDisconnect(): Promise<this> {
        try {
            this.connected = false;
            if (this.db) {
                this.db.end((err) => {
                    xlg.error("MYSQL CONNECTION CLOSE ERROR:", err);
                });
            }
            const conn: mysql.Connection = mysql.createConnection(db_config);
            conn.connect((err) => {
                if (err) {
                    xlg.error('error when connecting to db:', err);
                    setTimeout(this.handleDisconnect, 2000);
                    return;
                }
                this.connected = true;
                xlg.log("Connected to database");
            });
            conn.on('error', (err) => {
                this.connected = false;
                //console.log('db error', err);
                if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET' || err.code === 'ER_DATA_TOO_LONG') {
                    this.handleDisconnect();
                } else {
                    // throw err;// throwing an error in this error event handler will crash the application
                    xlg.error("FATAL DB ERROR:", err);
                    this.handleDisconnect();
                }
            });

            this.db = conn;
            this.query = util.promisify(conn.query).bind(conn);
            this.ping = util.promisify<mysql.QueryOptions | undefined>(conn.ping).bind(this.db);
            // util.promisify(conn.query).bind(conn)
            /*(query_str, query_var => {
                return new Promise((resolve, reject) => {
                    conn.query(query)
                })
            }*/

            this.query("CREATE TABLE IF NOT EXISTS `botstats` (`updateId` int(11) NOT NULL AUTO_INCREMENT, `logDate` timestamp NOT NULL DEFAULT current_timestamp(), `numUsers` int(11) NOT NULL DEFAULT 0, `numGuilds` int(11) NOT NULL DEFAULT 1, `numChannels` int(11) NOT NULL DEFAULT 0, PRIMARY KEY (`updateId`)) ENGINE=MyISAM AUTO_INCREMENT=76 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;");
            this.query("CREATE TABLE IF NOT EXISTS `clientstats` (`stat` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,`updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),`value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,`description` text COLLATE utf8mb4_unicode_ci NOT NULL,PRIMARY KEY (`stat`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
            this.query("CREATE TABLE IF NOT EXISTS `cmdtracking` (`cmdname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,`used` int(11) NOT NULL DEFAULT 0,`iscmd` tinyint(1) NOT NULL DEFAULT 1,PRIMARY KEY (`cmdname`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
            this.query("CREATE TABLE IF NOT EXISTS `dgmxp` ( `id` varchar(40) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL, `userid` varchar(30) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL, `guildid` varchar(30) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL, `timeAdded` timestamp NOT NULL DEFAULT current_timestamp(), `timeUpdated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(), `xp` int(11) NOT NULL, `level` int(11) NOT NULL DEFAULT 0, `msgcount` int(12) NOT NULL DEFAULT 0, `spideySaved` timestamp NULL DEFAULT NULL, `warnings` int(11) NOT NULL DEFAULT 0, `thinice` int(1) NOT NULL DEFAULT 0, UNIQUE KEY `id` (`id`)) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            this.query("CREATE TABLE IF NOT EXISTS `globalsettings` (`name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,`value` varchar(5000) COLLATE utf8mb4_unicode_ci NOT NULL,`previousvalue` varchar(5000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,`description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,`lastupdated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),`updatedby` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '745780460034195536',`category` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',PRIMARY KEY (`name`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
            this.query("CREATE TABLE IF NOT EXISTS `guildsettings` ( `id` int(11) NOT NULL AUTO_INCREMENT, `guildid` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL, `property` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL, `value` longtext COLLATE utf8mb4_unicode_ci NOT NULL, `previousvalue` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB AUTO_INCREMENT=153 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            this.query("CREATE TABLE IF NOT EXISTS `levelroles` (`id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,`guildid` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,`roleid` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,`level` int(11) NOT NULL DEFAULT 1,PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
            this.query("CREATE TABLE IF NOT EXISTS `prefix` (`guildid` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,`prefix` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,PRIMARY KEY (`guildid`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
            this.query("CREATE TABLE IF NOT EXISTS `twitchhooks` ( `id` varchar(35) COLLATE utf8mb4_unicode_ci NOT NULL, `streamerid` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL, `guildid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `channelid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `streamerlogin` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL, `message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL, `expires` timestamp NOT NULL DEFAULT current_timestamp(), `delafter` int(11) NOT NULL DEFAULT -1, `notified` int(11) NOT NULL DEFAULT 0, `laststream` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `subscriptionid` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            this.query("CREATE TABLE IF NOT EXISTS `dashusers` ( `userid` VARCHAR(18) NOT NULL , `tag` TINYTEXT NOT NULL , `avatar` TEXT NOT NULL , `guilds` MEDIUMTEXT NOT NULL , PRIMARY KEY (`userid`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
            this.query("CREATE TABLE IF NOT EXISTS `timedactions` ( `actionid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `exectime` timestamp NULL DEFAULT current_timestamp(), `actiontype` tinytext COLLATE utf8mb4_unicode_ci NOT NULL, `actiondata` text COLLATE utf8mb4_unicode_ci NOT NULL, `casenumber` int(11) NOT NULL DEFAULT 0, PRIMARY KEY (`actionid`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            this.query("CREATE TABLE IF NOT EXISTS `userdata` ( `userid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `createdat` timestamp NOT NULL DEFAULT current_timestamp(), `updatedat` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(), `bio` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `afk` text COLLATE utf8mb4_unicode_ci DEFAULT NULL, `offenses` int(11) DEFAULT 0, `nicknames` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `bans` int(11) DEFAULT 0, PRIMARY KEY (`userid`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            this.query("CREATE TABLE IF NOT EXISTS `guilduserdata` ( `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL, `userid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `guildid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `createdat` timestamp NOT NULL DEFAULT current_timestamp(), `updatedat` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(), `offenses` int(11) NOT NULL DEFAULT 0, `warnings` int(11) NOT NULL DEFAULT 0, `bans` int(11) NOT NULL DEFAULT 0, `bio` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `nicknames` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `roles` text COLLATE utf8mb4_unicode_ci DEFAULT NULL, `banned` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'false', `modnote` mediumtext COLLATE utf8mb4_unicode_ci DEFAULT '', PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            //this.query("CREATE TABLE IF NOT EXISTS `modactions` ( `id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL, `guildid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `type` tinytext COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'log', `data` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            this.query("CREATE TABLE IF NOT EXISTS `modactions` ( `id` int(11) NOT NULL AUTO_INCREMENT, `superid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `guildid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `casenumber` int(11) NOT NULL DEFAULT 0, `userid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `usertag` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `type` tinytext COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'log', `created` timestamp NOT NULL DEFAULT current_timestamp(), `updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(), `endtime` text COLLATE utf8mb4_unicode_ci DEFAULT NULL, `agent` text COLLATE utf8mb4_unicode_ci NOT NULL, `agenttag` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `summary` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `notified` tinyint(1) NOT NULL DEFAULT 0, PRIMARY KEY (`id`), UNIQUE KEY `superid` (`superid`)) ENGINE=InnoDB AUTO_INCREMENT=90 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            //async function dbInit() {}
            this.query("CREATE TABLE IF NOT EXISTS `cmdhistory` ( `invocation_id` int(11) NOT NULL AUTO_INCREMENT, `command_name` text COLLATE utf8mb4_unicode_ci NOT NULL, `message_content` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `guildid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `userid` varchar(18) COLLATE utf8mb4_unicode_ci DEFAULT NULL, `messageid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `channelid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `invocation_time` timestamp NOT NULL DEFAULT current_timestamp(), PRIMARY KEY (`invocation_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            this.query("CREATE TABLE IF NOT EXISTS `invitetracking` ( `id` int(11) NOT NULL AUTO_INCREMENT, `guildid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `inviteat` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(), `invitee` text COLLATE utf8mb4_unicode_ci NOT NULL, `inviteename` text COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '', `inviter` text COLLATE utf8mb4_unicode_ci NOT NULL, `invitername` text COLLATE utf8mb4_unicode_ci NOT NULL, `code` text COLLATE utf8mb4_unicode_ci NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            this.query("CREATE TABLE IF NOT EXISTS `starboard` ( `messageid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `guildid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `channelid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `authorid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `stars` int(11) NOT NULL DEFAULT 0, `nsfw` tinyint(1) NOT NULL DEFAULT 0, `locked` tinyint(1) NOT NULL DEFAULT 0, `postid` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, `postchannel` varchar(18) COLLATE utf8mb4_unicode_ci NOT NULL, PRIMARY KEY (`messageid`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            return this;
        } catch (error) {
            xlg.error(`DB Error: ${error.message}\nError: ${error.stack}`);
            return this;
        }
    }

    /**
     * Get a round trip ping (I assume it is accurate)
     * 
     * Returns a tuple [~seconds, =nanoseconds]
     */
    async getPing(): Promise<[number, number]> {
        const pingStart = process.hrtime();
        await this.ping(undefined);
        const pingResolution = process.hrtime(pingStart);
        return pingResolution;
    }

    /*escapeString(str: string) {
        return str.replace(/'/g, "\\'");
    }*/

    /**
     * query and retrieve values from the globalsettings table
     * @param {string} name name of setting to retrieve
     */
    async getGlobalSetting(name: string): Promise<GlobalSettingRow | false> {
        const rows = await <Promise<GlobalSettingRow[]>>this.query(`SELECT * FROM globalsettings WHERE name = ${escape(name)}`).catch(xlg.error);
        if (rows && rows.length > 0) {
            return rows[0];
        } else {
            return false;
        }
    }

    /**
     * Get the stored value paired to a color name in the database
     * @param name name of the color
     */
    async getColor(name: string): Promise<number> {
        if (name === "embed") {
            return 0x2F3136;
        }
        if (name === "normal") {
            return 0x202225;
        }
        if (!name.endsWith("_embed_color")) {
            name += "_embed_color";
        }
        // color cache lookup and management should go here
        const rows = await <Promise<GlobalSettingRow[]>>this.query(`SELECT * FROM globalsettings WHERE name = ${escape(name)}`).catch(xlg.error);
        if (!rows || rows.length == 0) {
            if (name === "info_embed_color") return 279673;
            if (name === "fail_embed_color") return 16711680;
            if (name === "warn_embed_color") return 16750899;
            if (name === "success_embed_color") return 4437377;
            return 0;
        }
        if (!isNaN(parseInt(rows[0].value, 10))) {
            return parseInt(rows[0].value);
        }
        return 0;
    }

    /**
     * Get the current amount of xp assigned to a user
     * @param target discord user object to select in database
     */
    async getXP(target: GuildMember): Promise<ExpRow | false> {
        if (!target) return false;
        const rows = await <Promise<ExpRow[]>>this.query(`SELECT * FROM dgmxp WHERE id = '${target.user.id}${target.guild.id}'`);
        if (rows && rows.length) {
            return rows[0];
        }
        return false;
    }

    getPointsForLevel(l: number): number {// as it turns out, stupid as shit me wrote "^" intending to write "**", fucking hilariously dumb
        return (5 * (l ** 2)) + (50 * l) + 100;
    }

    getCumulativePointsForLevel(lvl: number): number {
        let t = 0;
        for (let i = 0; i < lvl; i++) {
            t += this.getPointsForLevel(i);
        }
        return t;
    }

    /**
     * Uses a message sent by author to update their xp in the database
     * 
     * To generate xp, uses the formula:
     * 
     * `xp to next level = 5 * (lvl ^ 2) + 50 * lvl + 100`
     * 
     * @param message message sent to be counted for author
     * @returns nothing
     */
    async updateXP(member: GuildMember): Promise<void> {
        try {
            const maxs = await this.getGlobalSetting("max_xp");
    
            const genXP = () => {
                if (!maxs) return 15;
                return Math.floor(Math.random() * (parseInt(maxs.value, 10) - 15) + 15);
            }
            const { level } = await this.setXP(member.guild.id, member.id, genXP(), 1, true);

            if (level > -1) {
                this.updateLevelRole(member, level);
            }
        } catch (error) {
            xlg.error(error);
        }
    }

    /**
     * Set the amount of activity points assigned to a user using a direct value. Add to the current value or set value.
     * @param guildid string id of target guild
     * @param userid string id of target
     * @param amount target amount of points to add, subtract, or set to
     * @param mode the point set mode, specify less than 0 to subtract, 0 to set exactly, and greater than 0 to add
     * @returns the updated points and new level
     */
    async setXP(guildid: string, userid: string, amount: number, mode = 0, incrmsg = false): Promise<{ points: number, level: number }> {
        try {
            if (!guildid || !userid || typeof guildid !== "string" || typeof userid !== "string") return { points: -1, level: -1 };
            let l = 0;
            let p = 0;
            if (amount > Number.MAX_SAFE_INTEGER) {// if the amount to set/give/remove is too high, set mode to give 0
                amount = 0;
                mode = 1;
            }
            if (!mode) {// mode = 0, set exactly
                let level = 0;
                let totalNeeded = 0;
                while (amount > totalNeeded) {
                    totalNeeded += this.getPointsForLevel(level);
                    if (amount > totalNeeded) level++;
                }
                await <Promise<InsertionResult>>this.query(`INSERT INTO dgmxp (id, userid, guildid, xp, level, msgcount) VALUES (${escape(userid + guildid)}, ${escape(userid)}, ${escape(guildid)}, ${amount}, 0, ${incrmsg ? 1 : 0}) ON DUPLICATE KEY UPDATE xp = ${amount}, level = ${level}, msgcount = ${incrmsg ? "msgcount + 1" : "msgcount"}`);
                l = level;
                p = amount;
            } else {// 0 < mode < 0
                const rows = await <Promise<ExpRow[]>>this.query(`SELECT * FROM dgmxp WHERE id = ${escape(userid + guildid)}`);
                let sql;
                if (rows.length < 1) {// no entry yet, set the xp amount to whatever was given to the method
                    p = mode > 0 ? amount : 0 - amount;
                    sql = `INSERT INTO dgmxp (id, userid, guildid, xp, level, msgcount) VALUES (${escape(userid + guildid)}, ${escape(userid)}, ${escape(guildid)}, ${p}, 0, ${incrmsg ? 1 : 0})`;
                } else {
                    // SENSITIVE AREA
                    // xp to next level = 5 * (lvl ^ 2) + 50 * lvl + 100 for mee6
                    let xp = mode > 0 ? rows[0].xp + amount : rows[0].xp - amount;// mode > 0: add, mode < 0: subtract
                    if (xp > Number.MAX_SAFE_INTEGER) {
                        xp = rows[0].xp;
                    }
                    // let totalNeeded = 0;
                    // for (let x = 0; x < rows[0].level + 1; x++) {
                    //     totalNeeded += (5 * (x ** 2)) + (50 * x) + 100;
                    // }
                    // if (xp > totalNeeded) levelNow++;
                    let level = 0;
                    let totalNeeded = 0;
                    while (xp > totalNeeded) {
                        totalNeeded += this.getPointsForLevel(level);
                        if (xp > totalNeeded) level++;
                    }
                    // SENSITIVE AREA
                    /*let levelNow = Math.floor(0.1 * Math.sqrt(xp));
                    if (rows[0].level !== levelNow) {
                        rows[0].level = levelNow;
                    }*/
                    sql = `UPDATE dgmxp SET xp = ${xp}, level = ${level}, msgcount = ${incrmsg ? "msgcount + 1" : "msgcount"} WHERE id = ${escape(userid + guildid)}`;
                    l = level;
                    p = xp;
                }
                await <Promise<InsertionResult>>this.query(sql);
            }
            return { points: p, level: l };
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                xlg.error('error: ER_DUP_ENTRY caught and deflected');
            } else {
                xlg.error(error);
            }
        }
        return { points: -1, level: -1 };
    }

    /**
     * Get a data object for member's points that goes beyond the ExpRow
     * @returns extensive data about the points that members have
     */
    async getFullPointsData(target: GuildMember): Promise<FullPointsData | false> {
        if (!target) return false;
        const xpData = await this.getXP(target);
        if (!xpData) return false;
        const xp = xpData.xp;
        const level = xpData.level;
        const pointsLevelNow = this.getPointsForLevel(xpData.level);
        const pointsLevelNext = this.getPointsForLevel(xpData.level + 1);
        const toGo = this.getCumulativePointsForLevel(xpData.level + 1) - xp;
        const relFromLevel = pointsLevelNext - toGo;
        const last = new Date(xpData.timeUpdated);
        const first = new Date(xpData.timeAdded);
        return {
            guild: target.guild.id,
            user: target.id,
            points: xp,
            level,
            pointsLevelNext,
            pointsToGo: toGo,
            pointsInLevel: relFromLevel,
            pointsLevelNow,
            firstCounted: first,
            lastGained: last,
        }
    }

    /**
     * Gets the level roles in a guild and gives them to the provided member if they are missing some
     * @param member the member to apply the xp system to
     * @param level the level of the member to apply
     */
    async updateLevelRole(member: GuildMember, level: number): Promise<boolean> {
        if (!member || !member.guild || !level || !member.guild.me?.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) {
            return false;
        }
        let levelsEnabled: false | GuildSettingsRow | string = await this.getGuildSetting(member.guild, 'xp_levels');
        levelsEnabled = levelsEnabled ? levelsEnabled.value : false;
        if (levelsEnabled === "enabled") {
            member.guild.roles.cache = await member.guild.roles.fetch();
            const levelRows = await this.checkForLevelRoles(member.guild);
            if (!levelRows) return false;
            const availableRoles = [];
            for (let i = 0; i < levelRows.length; i++) {
                const r = levelRows[i];
                if (r.level <= level) {
                    availableRoles.push(member.guild.roles.cache.find(ro => ro.id === r.roleid) || null);
                }
            }
            if (availableRoles.length > 0) {
                for (let i = 0; i < availableRoles.length; i++) {
                    const r = availableRoles[i];
                    if (r) {
                        if (member.guild.me && r.comparePositionTo(member.guild.me.roles.highest) < 0) {
                            if (!member.roles.cache.find(ro => ro.id === r.id)) {
                                member.roles.add(r, 'levelling up').catch(xlg.error);
                            }
                        }
                    }

                }
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * This will check to see if level roles in a given guild exist. If they do not, it will create them. If they do, it will check to see if the roles still exist in the guild and delete the entries if they do not.
     * @param guild guild to check in
     */
    async checkForLevelRoles(guild: Guild): Promise<LevelRolesRow[] | void> {
        try {
            if (!guild) return;
            let levelRows = await <Promise<LevelRolesRow[]>>this.query(`SELECT * FROM levelroles WHERE guildid = '${guild.id}' ORDER BY level DESC`);
            if (!levelRows || !levelRows.length) {
                for (const ro of levelRoles) {
                    const roleToAdd = await guild.roles.create({
                        name: ro.name || `Level ${ro.level}`,
                        color: ro.color || '#99AAB1',
                        permissions: 0n,
                        position: 1
                    });
                    await this.query(`INSERT INTO levelroles (id, guildid, roleid, level) VALUES ('${guild.id + roleToAdd.id}', '${guild.id}', '${roleToAdd.id}', ${ro.level})`);
                }
                levelRows = await <Promise<LevelRolesRow[]>>this.query(`SELECT * FROM levelroles WHERE guildid = ${guild.id} ORDER BY level DESC`);
            } else {
                for (let i = 0; i < levelRows.length; i++) {
                    const dbro = guild.roles.cache.find(ro => ro.id === levelRows[i].roleid);
                    if (!dbro) {
                        await this.query(`DELETE FROM levelroles WHERE roleid = '${levelRows[i].roleid}'`).catch(e => console.log(e.stack))
                        levelRows.splice(i, 1);
                    }
                }
            }
            return levelRows;
        } catch (error) {
            xlg.error(error);
        }
    }

    async getLevelRoles(guildid: string): Promise<LevelRolesRow[] | false> {
        if (!guildid) return false;
        const rows = await <Promise<LevelRolesRow[]>>this.query(`SELECT * FROM levelroles WHERE guildid = ${guildid} ORDER BY level DESC`);
        if (rows && rows.length) {
            return rows;
        }
        return false;
    }

    /**
     * add a new row of current statistics to gm counters
     * @param {object} client running discord client
     */
    async updateBotStats(client: XClient): Promise<void> {
        try {
            const reductionFunc = (a: number, b: number) => a + b;
            const users = (await client.shard?.fetchClientValues("users.cache.size"))?.reduce(reductionFunc, 0);
            const guilds = (await client.shard?.fetchClientValues("guilds.cache.size"))?.reduce(reductionFunc, 0);
            const channels = (await client.shard?.fetchClientValues("channels.cache.size"))?.reduce(reductionFunc, 0);
            this.query(`INSERT INTO botstats (numUsers, numGuilds, numChannels) VALUES (${users}, ${guilds}, ${channels})`);
            const scConf = await client.database.getGlobalSetting("sc_conf");
            const statChannelGuild = scConf ? scConf.value.split(",")[0] : "745670883074637904";
            const statChannel = scConf ? scConf.value.split(",")[1] : "813404897403732008";
            if (isSnowflake(statChannelGuild) && isSnowflake(statChannel)) {
                const sg = await client.guilds.fetch(statChannelGuild);
                if (sg) {
                    const c = sg.channels.cache.get(statChannel);
                    if (c) {
                        await c.edit({
                            name: `${guilds} servers`
                        });
                    }
                }
            }
        } catch (error) {
            xlg.error(error);
        }
    }

    /**
     * Get historical statistics for the GM counter data
     * @param limiter number of past hours to retrieve
     */
    async getGMStats(limiter = 24): Promise<BSRow[]> {
        const et = moment().subtract(limiter, "hours").format('YYYY-MM-DD HH:mm:ss');
        const rows = await <Promise<BSRow[]>>this.query(`SELECT * FROM botstats WHERE logDate >= ${escape(et)} ORDER BY updateId DESC LIMIT ${limiter}`).catch(xlg.error);
        return rows;
    }

    /**
     * Update a setting for config in the global settings database
     * @param selectortype column being used to select (name, category)
     * @param selectorvalue value of column for selection
     * @param updateuser user
     * @param value setting value
     * @returns result object with edit information, or string for promise rejection
     */
    async editGlobalSettings(selectortype: 'name' | 'category', selectorvalue: string, updateuser: User, value = ""): Promise<InsertionResult> {
        return new Promise((resolve, reject) => {
            if (!selectortype || !selectorvalue || !value || !updateuser) return reject("MISSING_VALUES");
            if (selectortype !== "name" && selectortype !== "category") return reject("NAME_OR_CAT");// shouldn't really be necessary because of ts, now
            selectorvalue = selectorvalue.replace(/'/g, "\\'");
            value = value.replace(/'/g, "\\'");
            this.db.query(`UPDATE \`globalsettings\` SET \`previousvalue\`=\`value\`,\`value\`='${value}',\`updatedby\`='${updateuser.id}' WHERE \`${selectortype}\`='${selectorvalue}'`, (err, result: InsertionResult) => {
                if (err) throw err;
                if (result.affectedRows > 0) {
                    return resolve(result);
                } else if (selectortype === "name") {
                    this.db.query(`INSERT INTO \`globalsettings\`(\`name\`, \`value\`, \`updatedby\`, \`category\`) VALUES ('${selectorvalue}','${value}','${updateuser.id}', 'general')`, (err, result: InsertionResult) => {
                        if (err) throw err;
                        resolve(result);
                    });
                } else {
                    return reject("NONEXISTENT");
                }
            });
        });
    }

    /**
     * Get the prefix for a guild if it has one, otherwise it will be the default prefix stored in GlobalSettings
     * @param guildid Guild ID
     */
    async getPrefixes(guildid: string): Promise<{ gprefix: string, nprefix: string } | false> {
        const rows = await <Promise<{ value: string }[]>>this.query(`SELECT value FROM globalsettings WHERE name = 'global_prefix' ` +
            `UNION ALL SELECT prefix FROM prefix WHERE guildid = ${escape(guildid)}`);
        // SELECT value FROM globalsettings WHERE name = 'global_prefix' UNION ALL SELECT prefix FROM prefix WHERE guildid = '660242946834038785'
        // { guildid: string, prefix: string }[]
        if (rows.length > 0) {
            const prefixes = { gprefix: "", nprefix: "" };
            if (rows[0]) {
                prefixes.nprefix = rows[0].value;
                prefixes.gprefix = rows[0].value;
            }
            if (rows[1]) {
                prefixes.gprefix = rows[1].value;
            }
            return prefixes;
        } else {
            return false;
        }
    }

    /**
     * Change the prefix (before commands) per guilds
     * @param guildid ID of guild to update
     * @param newprefix New prefix for guild
     */
    async setPrefix(guildid = "", newprefix = ""): Promise<void> {
        newprefix = newprefix.replace(/'/g, "\\'");
        const rows = await <Promise<{ guildid: string, prefix: string }[]>>this.query(`SELECT \`prefix\` FROM \`prefix\` WHERE \`guildid\` = '${guildid}'`).catch(xlg.error);
        if (rows.length > 0) {
            await <Promise<InsertionResult>>this.query(`UPDATE \`prefix\` SET \`prefix\`='${newprefix}' WHERE \`guildid\`='${guildid}'`).catch(xlg.error);
        } else {
            await <Promise<InsertionResult>>this.query(`INSERT INTO \`prefix\`(\`guildid\`, \`prefix\`) VALUES ('${guildid}', '${newprefix}')`).catch(xlg.error);
        }
    }

    async getXPPersonal(guildid: Snowflake, memberid: Snowflake): Promise<PersonalExpRow | false> {
        const personalrows = await <Promise<PersonalExpRow[]>>this.query(`SELECT \`userid\`, \`xp\`, \`level\`, FIND_IN_SET(\`xp\`, (SELECT GROUP_CONCAT(\`xp\` ORDER BY \`xp\` DESC) FROM dgmxp WHERE guildid = ${escape(guildid)} ) ) AS rank FROM dgmxp WHERE id = ${escape(memberid + guildid)}`);
        if (personalrows.length) {
            return personalrows[0];
        }
        return false;
    }

    /**
     * Gets the top 10 members by xp of a guild plus the ranking of the provided member.
     * @param guildid id of guild to look up
     * @param memberid id of member in guild to look up
     */
    async getXPTop10(guildid: Snowflake, memberid: Snowflake): Promise<{ rows: ExpRow[], personal?: PersonalExpRow, total: number }> {
        const rows = await <Promise<ExpRow[]>>this.query(`SELECT * FROM \`dgmxp\` WHERE \`guildid\` = ${escape(guildid)} ORDER BY \`xp\` DESC LIMIT 10`);
        const personalrows = await this.getXPPersonal(guildid, memberid);
        const person = personalrows || undefined;
        const total = await <Promise<(Partial<ExpRow> & { p: string })[]>>this.query(`SELECT '' AS \`p\` FROM \`dgmxp\` WHERE \`guildid\` = ${escape(guildid)}`);
        return {
            rows: rows || [],
            personal: person,
            total: total.length
        };
    }

    /**
     * Gets the value of a discord guild setting, if it exists.
     * @param guild guild object
     * @param name property name
     */
    async getGuildSetting(guild: string | Guild, name: string): Promise<GuildSettingsRow | false> {
        try {
            if (!guild) return false;
            const gid = guild instanceof Guild ? guild.id : guild;
            const rows = await <Promise<GuildSettingsRow[]>>this.query(`SELECT * FROM guildsettings WHERE guildid = '${gid}' AND property = '${name}'`);
            if (rows.length > 0) {
                return rows[0];
            } else {
                return false;
            }
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Edits or deletes a setting for an individual Discord Guild.
     * @param guild guild object to edit the settings for
     * @param name property name of the setting
     * @param value value to set for the property
     * @param deleting whether to delete the setting
     */
    async editGuildSetting(guild: Guild | PartialGuildObject | string, name = "", value = "", deleting = false): Promise<InsertionResult> {
        return new Promise((resolve, reject) => {
            if (!guild || !name) return reject("MISSING_VALUES");
            const id = typeof guild === "string" ? guild : guild.id;
            if (deleting) {
                return this.db.query(`DELETE FROM \`guildsettings\` WHERE guildid = ${escape(id)} AND property = ${escape(name)}`, (err, result: InsertionResult) => {
                    if (err) throw err;
                    if (result.affectedRows > 0) {
                        return resolve(result);
                    } else {
                        reject('NO_DELETION');
                    }
                });
            }
            if (!value) return reject("MISSING_VALUES");
            this.db.query(`UPDATE \`guildsettings\` SET \`previousvalue\`=\`value\`,\`value\`=${escape(value)} WHERE guildid = ${escape(id)} AND property = ${escape(name)}`, (err, result: InsertionResult) => {
                if (err) throw err;
                if (result.affectedRows > 0) {
                    return resolve(result);
                } else {
                    this.db.query(`INSERT INTO \`guildsettings\`(\`guildid\`, \`property\`, \`value\`) VALUES (${escape(id)}, ${escape(name)}, ${escape(value)})`, (err, result: InsertionResult) => {
                        if (err) throw err;
                        resolve(result);
                    });
                }
            });
        });
    }

    /**
     * Deletes the xp entry for a member of a guild.
     * @param member guild member to delete the xp for
     */
    async clearXP(member: GuildMember | PartialGuildMember): Promise<number> {
        if (!member || !member.id || !member.guild || !member.guild.id) return 0;
        const result = await <Promise<InsertionResult>>this.query(`DELETE FROM dgmxp WHERE guildid = '${member.guild.id}' AND userid = '${member.id}'`).catch(xlg.error);
        return result.affectedRows || 0;
    }

    /**
     * Deletes all xp entries for a guild.
     * @param guild guild to delete the xp from
     */
    async massClearXP(guild: Guild): Promise<number> {
        if (!guild) return 0;
        const result = await <Promise<InsertionResult>>this.query(`DELETE FROM dgmxp WHERE guildid = '${guild.id}'`).catch(xlg.error);
        return result.affectedRows || 0;
    }

    /**
     * Configure the role reward roles for a given guild.
     * @param level the current level for the role to be set to
     * @param guild the guild for the role to be set to
     * @param role the role to be added or configured
     * @param deleting whether or not the given role should be deleted from the database, if true the level param will be ignored
     */
    async setLevelRole(level: number | null, guild: Guild, role: Role, deleting = false): Promise<LevelRolesRow[] | number | false> {
        if (!guild || !guild.id) return false;
        let result;
        if (role && deleting) {
            if (!role.id) return false;
            result = await <Promise<InsertionResult>>this.query(`DELETE FROM levelroles WHERE guildid = '${guild.id}' AND roleid = '${role.id}'`);
            return result.affectedRows || false;
        }
        if (level && role) {
            if (!role.id) return false;
            result = await <Promise<InsertionResult>>this.query(`UPDATE levelroles SET level = ${level} WHERE guildid = '${guild.id}' AND roleid = '${role.id}'`);
            if (!result) return false;
            if (result.affectedRows === 0) {
                //guild.roles.create()
                result = await <Promise<InsertionResult>>this.query(`INSERT INTO levelroles (id, guildid, roleid, level) VALUES ('${guild.id + role.id}', '${guild.id}', '${role.id}', ${level})`);
            }
            return result.affectedRows;
        }
        if (role) {
            if (!role.id) return false;
            result = await <Promise<LevelRolesRow[]>>this.query(`SELECT * FROM levelroles WHERE guildid = '${guild.id}' AND roleid = '${role.id}'`);
            if (!result.length) return false;
            return result;
        }
        result = await <Promise<LevelRolesRow[]>>this.query(`SELECT * FROM levelroles WHERE guildid = '${guild.id}' ORDER BY level DESC`);
        if (!result[0]) return false;
        return result;
    }

    /**
     * Deletes all of the level roles for a given guild
     * @param guild the guild to delete the roles of
     */
    async deleteAllLevelRoles(guild: Guild): Promise<InsertionResult | false> {
        if (!(guild instanceof Discord.Guild)) return false;
        const result = await <Promise<InsertionResult>>this.query(`DELETE FROM levelroles WHERE guildid = '${guild.id}'`);
        if (result && result.affectedRows > 0) return result;
        return false;
    }

    /**
     * Log command usage (after execution)
     * @param name name of command being logged
     */
    async logCmdUsage(name: string, message?: XMessage): Promise<void> {
        try {
            if (Bot.client.msgLogging) {
                const logChannel = Bot.client.channels.cache.get(typeof Bot.client.msgLogging === "string" && isSnowflake(Bot.client.msgLogging) ? Bot.client.msgLogging : '661614128204480522');
                if (logChannel && logChannel instanceof TextChannel) {
                    let s = `\`${name}\` sent`;
                    if (message) {
                        s += ` at \`${message.id}\` in \`${message.channel.id}\` ${message.url}`;
                    }
                    logChannel.send(s).catch(console.error);
                }
            }

            const oresult = await <Promise<CmdTrackingRow[]>>this.query(`SELECT * FROM cmdtracking WHERE cmdname = 'all'`);
            const result = await <Promise<CmdTrackingRow[]>>this.query(`SELECT * FROM cmdtracking WHERE cmdname = '${name}'`);
            if (!oresult || oresult.length === 0) {
                await <Promise<InsertionResult>>this.query(`INSERT INTO cmdtracking (cmdname, used) VALUES ('all', 1)`);
            } else {
                await <Promise<InsertionResult>>this.query(`UPDATE cmdtracking SET used = used + 1 WHERE cmdname = 'all'`);

            }
            if (!result || result.length === 0) {
                await <Promise<InsertionResult>>this.query(`INSERT INTO cmdtracking (cmdname, used) VALUES ('${name}', 1)`);
            } else {
                await <Promise<InsertionResult>>this.query(`UPDATE cmdtracking SET used = used + 1 WHERE cmdname = '${name}'`);
            }

            if (message) {
                await <Promise<InsertionResult>>this.query(`INSERT INTO cmdhistory (command_name, guildid, userid, messageid, channelid) VALUES (${escape(name)}, ${escape(message.guild?.id || "")}, ${escape(message.author.id)}, ${escape(message.id)}, ${escape(message.channel.id)})`);
            }
        } catch (error) {
            xlg.error(error);
        }
    }

    /**
     * Get total number of commands sent from db
     * @returns result object with edit information, or string for promise rejection
     */
    async getTotalCmdUsage(): Promise<CmdTrackingRow[] | undefined> {
        try {
            return await <Promise<CmdTrackingRow[]>>this.query(`SELECT * FROM cmdtracking WHERE cmdname = 'all'`);
        } catch (error) {
            xlg.error(error);
        }
    }

    /**
     * Update a setting for config in the global settings database
     */
    async logMsgReceive(): Promise<void> {
        try {
            const result = await <Promise<GlobalSettingRow[]>>this.query(`SELECT * FROM globalsettings WHERE name = 'mreceived'`);
            if (!result || result.length === 0) {
                await <Promise<InsertionResult>>this.query(`INSERT INTO globalsettings (name, value) VALUES ('mreceived', '1')`);
            } else {
                await <Promise<InsertionResult>>this.query(`UPDATE \`globalsettings\` SET \`previousvalue\`=\`value\`,\`value\`= value + 1 WHERE \`name\`='mreceived'`);
            }
        } catch (error) {
            xlg.error(error);
        }
    }

    /**
     * Update a setting for config in the global settings database
     */
    async logDefined(): Promise<void> {
        try {
            const result = await <Promise<GlobalSettingRow[]>>this.query(`SELECT * FROM globalsettings WHERE name = 'definedcount'`);
            if (!result || result.length === 0) {
                await <Promise<InsertionResult>>this.query(`INSERT INTO globalsettings (name, value) VALUES ('definedcount', '1')`);
            } else {
                await <Promise<InsertionResult>>this.query(`UPDATE globalsettings SET previousvalue=value, value=value + 1 WHERE name='definedcount'`);
            }
        } catch (error) {
            xlg.error(error);
        }
    }

    /**
     * Set that spidey saved a member
     * @param member object of the member who was saved
     */
    async setSpideySaved(target: GuildMember): Promise<boolean> {
        try {
            const result = await <Promise<ExpRow[]>>this.query(`SELECT * FROM dgmxp WHERE id = '${target.user.id}${target.guild.id}'`);
            if (!result || result.length === 0) {
                return false;
            } else {
                //const mysqlTimestamp = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
                await this.query(`UPDATE dgmxp SET spideySaved = CURRENT_TIMESTAMP WHERE id = '${target.user.id}${target.guild.id}'`);
                return true;
            }
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Create a subscription entry for Twitch webhooks in the database
     * @param streamerid twitch id of streamer
     * @param guildid id of guild for subscription
     * @param expiredate a parseable date to be used to sort by timestamps for renewal
     * @param message (optional) the message that will be sent with the discord notification
     */
    async addTwitchSubscription(streamerid: string, guildid: string, channelid: string, expiredate: moment.DurationInputArg1, message = "", name: string, delafter = -1, notified = 0, subscriptionid: string): Promise<boolean> {
        try {
            if (!streamerid || !guildid || !channelid || !expiredate || !name) return false;
            const result = await <Promise<TwitchHookRow[]>>this.query(`SELECT * FROM twitchhooks WHERE streamerid = '${streamerid}' AND guildid = '${guildid}'`);
            const expiresTimestamp = moment().add(expiredate).format('YYYY-MM-DD HH:mm:ss');
            if (!result || !result[0]) {
                if (!message || !message.length || typeof message !== "string") {
                    await this.query(`INSERT INTO twitchhooks (id, streamerid, guildid, channelid, expires, streamerlogin, delafter, notified, subscriptionid) VALUES (${escape(`${streamerid}${guildid}`)}, ${escape(streamerid)}, ${escape(guildid)}, ${escape(channelid)}, ${escape(expiresTimestamp)}, ${escape(name)}, ${escape(delafter)}, ${escape(notified)}, ${escape(subscriptionid)})`);
                } else {
                    await this.query(`INSERT INTO twitchhooks (id, streamerid, guildid, channelid, message, expires, streamerlogin, delafter, notified, subscriptionid) VALUES (${escape(`${streamerid}${guildid}`)}, ${escape(streamerid)}, ${escape(guildid)}, ${escape(channelid)}, ${escape(message)}, ${escape(expiresTimestamp)}, ${escape(name)}, ${escape(delafter)}, ${escape(notified)}, ${escape(subscriptionid)})`);
                }
                return true;
            } else {
                if (!message || !message.length || typeof message !== "string") {
                    await this.query(`UPDATE twitchhooks SET expires = ${escape(expiresTimestamp)}, channelid = ${escape(channelid)}, streamerlogin = ${escape(name)}, delafter = ${escape(delafter)}, notified = ${escape(notified)}, subscriptionid = ${escape(subscriptionid)} WHERE id = ${escape(`${streamerid}${guildid}`)}`);
                } else {
                    await this.query(`UPDATE twitchhooks SET expires = ${escape(expiresTimestamp)}, channelid = ${escape(channelid)}, streamerlogin = '${name}', message = ${escape(message)}, delafter = ${escape(delafter)}, notified = ${escape(notified)}, subscriptionid = ${escape(subscriptionid)} WHERE id = ${escape(`${streamerid}${guildid}`)}`);
                }
                return true;
            }
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Create a subscription entry for Twitch webhooks in the database
     * @param {string} streamerid twitch id of streamer
     * @param {string} guildid id of guild for subscription
     * @param {*} expiredate a parseable date to be used to sort by timestamps for renewal
     * @param {string} message (optional) the message that will be sent with the discord notification
     */
    async removeTwitchSubscription(streamerid: string, guildid: string): Promise<number | false> {
        try {
            if (!streamerid || !guildid) return false;
            const delresult = await <Promise<InsertionResult>>this.query(`DELETE FROM twitchhooks WHERE streamerid = ${escape(streamerid)} AND guildid = ${escape(guildid)}`);
            return delresult.affectedRows;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    async removeAllTwitchStreamerSubscriptions(streamerid: string): Promise<InsertionResult | false> {
        try {
            if (!streamerid) return false;
            const delresult = await <Promise<InsertionResult>>this.query(`DELETE FROM twitchhooks WHERE streamerid = ${escape(streamerid)}`);
            return delresult;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * get a list of database entries that use a specified streamer id
     * @param {string} streamerid twitch id of streamer
     */
    async getTwitchSubsForID(streamerid: string): Promise<false | TwitchHookRow[]> {
        try {
            if (!streamerid) return false;
            const result = await <Promise<TwitchHookRow[]>>this.query(`SELECT * FROM twitchhooks WHERE streamerid = ${escape(streamerid)}`);
            return result;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * get a list of database entries that belong to a specific guild
     * @param {string} streamerid twitch id of streamer
     */
    async getTwitchSubsGuild(guildid: string): Promise<false | TwitchHookRow[]> {
        try {
            if (!guildid) return false;
            const result = await <Promise<TwitchHookRow[]>>this.query(`SELECT * FROM twitchhooks WHERE guildid = ${escape(guildid)}`);
            if (!result.length) return false;
            return result;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    async getUniqueTwitchSubscriptions(): Promise<{ streamerid: string, streamerlogin: string }[]> {
        const rows = await <Promise<{ streamerid: string, streamerlogin: string }[]>>this.query(`SELECT streamerid, streamerlogin FROM twitchhooks GROUP BY streamerid`);
        xlg.log("rows:", rows)
        return rows;
    }

    async getTwitchSubIDForStreamerID(streamerid: string): Promise<string | false> {
        const rows = await <Promise<TwitchHookRow[]>>this.query(`SELECT * FROM twitchhooks WHERE streamerid = ${escape(streamerid)}`);
        if (rows.length) {
            const id = rows.reduce((p, c) => p.subscriptionid ? p : c).subscriptionid;
            if (id) {
                return id;
            }
        }
        return false;
    }

    /**
     * Increment the notified column of all twitch subscriptions under an id
     */
    async incrementTwitchNotified(streamid: string, started?: string): Promise<InsertionResult | false> {
        const t = started ?? new Date().toISOString();
        const sql = `UPDATE twitchhooks SET notified = notified + 1, laststream = ${escape(t)} WHERE streamerid = ${escape(streamid)}`;
        const result = await <Promise<InsertionResult>>this.query(sql);
        return result;
    }

    /**
     * Checks for a user of the dashboard and updates its values.
     */
    async updateDashUser(id: string, username: string, discriminator: string, avatar: string, guilds: PartialGuildObject[]): Promise<false | InsertionResult> {
        try {
            if (!id || !username || !discriminator) return false;
            if (!avatar) {
                avatar = "";
            }
            const guildString = JSON.stringify(guilds).escapeSpecialChars();
            const result = await <Promise<InsertionResult>>this.query(`INSERT INTO dashusers (userid, tag, avatar, guilds) VALUES (${escape(id)}, ${escape(`${username}#${discriminator}`)} , ${escape(avatar)}, ${escape(guildString)}) ON DUPLICATE KEY UPDATE tag = ${escape(`${username}#${discriminator}`)}, avatar = ${escape(avatar)}, guilds = ${escape(guildString)}`);
            if (!result || !result.affectedRows) {
                return false;
            }
            return result;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Get a user for the dashboard, if one exists in the database. It finds by user id.
     */
    async getDashUser(id: string): Promise<false | DashUserObject> {
        try {
            if (!id) return false;
            const result = await <Promise<{ userid: string, tag: string, avatar: string, guilds: string }[]>>this.query(`SELECT * FROM dashusers WHERE userid = ${escape(id)}`);
            if (!result || !result[0] || !result[0].userid) {
                return false;
            }
            const fr = result[0];
            const dashuser: DashUserObject = {
                id: fr.userid,
                tag: fr.tag,
                avatar: fr.avatar,
                guilds: JSON.parse(fr.guilds) || []
            }
            return dashuser;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Set an action to be executed automatically at a given time
     */
    async setAction(id: string, time: Date, actionType: string, data: TimedAction["data"], casenumber = 0): Promise<boolean> {
        try {
            const mtime = moment(time).format('YYYY-MM-DD HH:mm:ss');
            const actionData = JSON.stringify(data).escapeSpecialChars();

            const r = await <Promise<InsertionResult>>this.query(`INSERT INTO timedactions (actionid, exectime, actiontype, actiondata, casenumber) VALUES (${escape(id)}, ${escape(mtime)}, ${escape(actionType)}, ${escape(actionData)}, ${escape(casenumber)}) ON DUPLICATE KEY UPDATE exectime = ${escape(mtime)}, actiontype = ${escape(actionType)}, actiondata = ${escape(actionData)}, casenumber = ${escape(casenumber)}`);

            if (!r || !r.affectedRows) {
                return false;
            }
            return true;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Update the time an action will be executed at. If the action does not exist
     */
    async updateActionTime(id: string, time: Date): Promise<boolean> {
        try {
            const mtime = moment(time).format('YYYY-MM-DD HH:mm:ss');

            const r = await <Promise<InsertionResult>>this.query(`UPDATE timedactions SET exectime = ${escape(mtime)} WHERE actionid = ${escape(id)}`);
            if (!r || !r.affectedRows) {
                return false;
            }
            return true;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Get all actions up to the number of give seconds ahead of the current time.
     * @param lookahead number representing the number of seconds to look ahead in the db
     */
    async getTimedActionsRange(lookahead: number): Promise<TimedAction[] | false> {
        if (lookahead < 0 || lookahead > 3600) return false;
        const et = moment().add(lookahead, "seconds").format('YYYY-MM-DD HH:mm:ss');
        const r = await <Promise<TimedActionRow[]>>this.query(`SELECT * FROM timedactions WHERE exectime <= ${escape(et)}`);
        if (!r || !r.length) {
            return [];
        }
        const parsed: TimedAction[] = [];
        for (const a of r) {
            const b: TimedAction = {
                id: a.actionid,
                time: moment(a.exectime).toDate(),
                type: a.actiontype,
                data: JSON.parse(a.actiondata),
                case: a.casenumber
            }
            parsed.push(b);
        }
        return parsed;
    }

    /**
     * Query the db to find scheduled actions for the bot to take
     * @param query Options: {
     *   actionid: string;
     *   exectime: string;
     *   actiontype: string;
     *   actiondata: string;
     *   casenumber: number;
     * }
     * @returns an array of timed actions
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getTimedActions/* <T = Record<string, any>> */(query: TimedActionQuery): Promise<TimedAction[] | false> {
        try {
            const queryOptions = <(keyof TimedActionQuery)[]>Object.keys(query);
            if (!queryOptions.length) return false;
            let sql = `SELECT * FROM timedactions WHERE`;
            for (let i = 0; i < queryOptions.length; i++) {
                const opt = queryOptions[i];
                const val = query[opt];
                sql += `${i === 0 ? "" : " AND"} \`${opt}\` = ${escape(val)}`;
            }
            const result = await <Promise<TimedActionRow[]>>this.query(`${sql}`);
            if (result.length) {
                const a: TimedAction[] = [];
                for (const row of result) {
                    try {
                        const b: TimedAction = {
                            id: row.actionid,
                            time: moment(row.exectime).toDate(),
                            type: row.actiontype,
                            data: JSON.parse(row.actiondata),
                            case: row.casenumber
                        }
                        a.push(b);
                    } catch (error) {
                        //
                    }
                }
                return a;
            }
            return [];
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Query the db to a scheduled action for the bot to take
     * @param query Options: {
     *   actionid: string;
     *   exectime: string;
     *   actiontype: string;
     *   actiondata: string;
     *   casenumber: number;
     * }
     * @returns a single timed action, if one is found
     */
    async getTimedAction(query: TimedActionQuery): Promise<TimedAction | false> {
        try {
            const queryOptions = <(keyof TimedActionQuery)[]>Object.keys(query);
            if (!queryOptions.length) return false;
            let sql = `SELECT * FROM timedactions WHERE`;
            for (let i = 0; i < queryOptions.length; i++) {
                const opt = queryOptions[i];
                const val = query[opt];
                sql += `${i === 0 ? "" : " AND"} \`${opt}\` = ${escape(val)}`;
            }
            const result = await <Promise<TimedActionRow[]>>this.query(`${sql}`);
            if (result.length) {
                const a = result[0];
                const b: TimedAction = {
                    id: a.actionid,
                    time: moment(a.exectime).toDate(),
                    type: a.actiontype,
                    data: JSON.parse(a.actiondata),
                    case: a.casenumber
                }
                return b;
            }
            return false;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Delete an existing action in the timedactions queue.
     */
    async deleteAction(id: string): Promise<InsertionResult> {
        const result = await <Promise<InsertionResult>>this.query(`DELETE FROM timedactions WHERE actionid = ${escape(id)}`);
        return result;
    }

    /**
     * Get discord global user data, stored in the database.
     */
    async getUserData(userid: Snowflake): Promise<UserDataRow> {
        const defaults: UserDataRow = {
            userid: userid,
        }
        try {
            const rows = await <Promise<UserDataRow[]>>this.query(`SELECT * FROM userdata WHERE userid = ${escape(userid)}`);
            if (rows && rows.length > 0) {
                return rows[0];
            } else {
                return defaults;
            }
        } catch (error) {
            xlg.error(error);
            return defaults;
        }
    }

    /**
     * Update a user's data. This is global data (opposed to guild data).
     */
    async updateUserData(data: UserDataRow): Promise<InsertionResult | false> {
        try {
            // eslint-disable-next-line prefer-const
            let { userid, afk, offenses, nicknames, bans, bio } = data;
            if (!userid) return false;
            let afk2 = afk;
            if (afk === "~~off~~") {
                afk2 = null;
            }
            const sql = `INSERT INTO userdata (userid, afk, offenses, nicknames, bans, bio) VALUES (${escape(userid)}, ${escape(afk2)}, ${escape(offenses || 0)}, ${escape(nicknames || "")}, ${escape(bans || 0)}, ${escape(bio || "")}) ON DUPLICATE KEY UPDATE afk = ${afk === "~~off~~" ? `${escape(afk2)}` : `COALESCE(${escape(afk2)}, afk)`}, offenses = COALESCE(${escape(offenses)}, offenses), nicknames = COALESCE(${escape(nicknames)}, nicknames), bans = COALESCE(${escape(bans)}, bans), bio = COALESCE(${escape(bio)}, bio)`;
            const result = await <Promise<InsertionResult>>this.query(sql);
            if (!result || !result.affectedRows) {
                return false;
            }
            return result;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Get all guild settings in an array where the property/name begins with a given prefix.
     */
    async getGuildSettingsByPrefix(guildid: string, prefix: string): Promise<GuildSettingsRow[] | false> {
        if (!guildid || !prefix) return false;
        const result = await <Promise<GuildSettingsRow[]>>this.query(`SELECT * FROM \`guildsettings\` WHERE \`guildid\` = '${guildid.replace(/'/g, "\\'")}' AND \`property\` LIKE '${prefix.replace(/'/g, "\\'")}%'`);
        if (!result || !result.length) {
            return [];
        }
        return result;
    }

    /**
     * Get an automodule for a guild, or create one from the default values.
     */
    async getAutoModule(guildid: Snowflake, mod: string, row?: GuildSettingsRow): Promise<AutomoduleData> {
        const defaults: AutomoduleData = {
            name: mod,
            text: false,
            enableAll: false,
            applyRoles: [],
            roleEffect: 'ignore',
            offensesOffset: 0,
        }
        defaults.text = Bot.client.services.isText(`automod_${mod}`);
        if (defaults.text) {// 
            defaults.channels = [];
            defaults.channelEffect = 'enable';
        }
        // VV this is a final check for the presence of argument data; for instance, if an actual module name is not provided, defaults should just be returned
        if (!guildid || !mod) return defaults;// if the guild was not provided or the mod name was not provided return default
        //TODO: make a method like the getGuildRoles() method below for the channels to avoid fetching so much data that has to be parsed
        const allChannels = await shards.getAllChannels();// get all channels to check the module channels against in order to filter out deleted channels
        if (!allChannels) {
            return defaults;
        }
        const guildRoles = await shards.getGuildRoles(guildid);// get all roles to check the module applyRoles against in order to filter out deleted roles
        if (!guildRoles) {
            return defaults;
        }
        const safeParseAM = (r: GuildSettingsRow): AutomoduleData => {
            try {
                const parsed = JSON.parse(r.value);
                if (typeof parsed.name !== "string" || typeof parsed.text !== "boolean" || typeof parsed.enableAll !== "boolean" || !Array.isArray(parsed.applyRoles) || typeof parsed.roleEffect !== "string" || (defaults.text && (!Array.isArray(parsed.channels) || typeof parsed.channelEffect !== "string"))) {
                    return defaults;
                } else {
                    if (parsed.channels && parsed.channels.length) {
                        parsed.channels = parsed.channels.filter((x: string) => {
                            return !!allChannels.find(x2 => x2.id === x);
                        });
                    }
                    if (parsed.applyRoles.length) {
                        parsed.applyRoles = parsed.applyRoles.filter((x: string) => {
                            return !!guildRoles.find(x2 => x2.id === x);
                        });
                    }
                    return parsed;
                }
            } catch (error) {
                return defaults;
            }
        }
        if (row) {// if a row (presumably containing automodule data) is provided and this method is just being used to safely parse and provide defaults
            return safeParseAM(row);
        }
        // I have no idea why I didn't just do getGuildSetting in the first place, my stupid fucking error caused it to get any existing automod setting in the db causing it to activate automod for all servers.
        //const result = await <Promise<GuildSettingsRow[]>>this.query(`SELECT * FROM guildsettings WHERE property = 'automod_${mod.replace(/'/g, "\\'")}'`);
        const result = await this.getGuildSetting(guildid, `automod_${mod}`);
        if (result) {// if automodule data was found
            return safeParseAM(result);
        }
        return defaults;// if all else fails, return defaults
    }

    /**
     * Get every automodule for a guild.
     */
    async getAllAutoModules(guildid: Snowflake): Promise<AutomoduleData[]> {
        if (!guildid) return [];
        const services = Bot.client.services?.automods || [];
        const modConf = await this.getGuildSettingsByPrefix(guildid, "automod_") || [];
        const guildMods: AutomoduleData[] = [];
        for await (const serv of services) {
            const am = await this.getAutoModule(guildid, serv, modConf.find(x => x.property === `automod_${serv}`));
            guildMods.push(am);
        }
        return guildMods;
    }

    /**
     * Check if an automodule is enabled given different check values.
     */
    async getAutoModuleEnabled(guildid: Snowflake, mod: string, channelid?: string, anywhere?: boolean, member?: GuildMember): Promise<false | AutomoduleData> {
        if (!guildid || !mod) return false;
        const m = await this.getAutoModule(guildid, mod);

        if (m.enableAll || m.channels?.length || m.channelEffect === "disable") {
            if (member) {
                const roles = member.roles.cache.map(r => r.id);
                const incl = m.applyRoles.some((r) => {
                    return isSnowflake(r) && roles.includes(r);
                });
                if (m.roleEffect === "ignore" && incl) {
                    return false;
                }
                if (m.roleEffect === "watch" && m.applyRoles.length && !incl) {
                    return false;
                }
            }

            if (m.enableAll) {
                return m;
            }

            if (channelid && m.channels?.includes(channelid)) {
                if (m.channelEffect === "enable") {
                    return m;
                }
                if (m.channelEffect === "disable") {
                    return false;
                }
            }

            if (m.channelEffect === "disable") {
                return m;
            }

            if (anywhere && (m.channels?.length)) {
                return m;
            }
        }
        return false;
    }

    async getGuildUserData(guildid: Snowflake, userid: Snowflake): Promise<GuildUserDataRow> {
        const defaults: GuildUserDataRow = {
            id: guildid + userid,
            userid: userid,
            guildid: guildid,
            createdat: "",
            updatedat: "",
            offenses: 0,
            warnings: 0,
            bans: 0,
            bio: "",
            nicknames: "",
            roles: "",
            modnote: "",
        }
        try {
            const rows = await <Promise<GuildUserDataRow[]>>this.query(`SELECT * FROM guilduserdata WHERE id = ${escape(guildid + userid)}`);
            if (rows && rows.length > 0) {
                return rows[0];
            } else {
                return defaults;
            }
        } catch (error) {
            xlg.error(error);
            return defaults;
        }
    }

    /**
     * Update a user's data. This is global data (opposed to guild data).
     */
    async updateGuildUserData(data: GuildUserDataRow): Promise<InsertionResult | false> {
        try {
            const { guildid, userid, offenses, warnings, bans, bio, nicknames, modnote, roles} = data;
            if (!guildid || !userid) return false;
            const sql = `INSERT INTO guilduserdata (id, userid, guildid, offenses, warnings, bans, bio, nicknames, modnote, roles) VALUES (${escape(guildid + userid)}, ${escape(userid)}, ${escape(guildid)}, ${escape(offenses || 0)}, ${escape(warnings || 0)}, ${escape(bans || 0)}, ${escape(bio || "")}, ${escape(nicknames || "")}, ${escape(modnote)}, ${escape(roles)}) ON DUPLICATE KEY UPDATE offenses = COALESCE(${escape(offenses)}, offenses), warnings = COALESCE(${escape(warnings)}, warnings), bans = COALESCE(${escape(bans)}, bans), bio = COALESCE(${escape(bio)}, bio), nicknames = COALESCE(${escape(nicknames)}, nicknames), modnote = COALESCE(${escape(modnote)}, modnote), roles = COALESCE(${escape(roles)}, roles)`;
            const result = await <Promise<InsertionResult>>this.query(sql);
            if (!result || !result.affectedRows) {
                return false;
            }
            return result;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Search for a case by its case number
     */
    async getModActionByGuildCase(guildid: string, num: number): Promise<ModActionData | false> {
        try {
            if (!Number.isSafeInteger(num)) return false;
            const rows = await <Promise<ModActionData[]>>this.query(`SELECT * FROM modactions WHERE guildid = ${escape(guildid)} AND casenumber = ${num}`);
            if (rows && rows.length > 0) {
                return rows[0];
            }
            return false;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    // public getModAction = {
    //     async byGuildCase(): Promise<ModActionData | false> {
    //         try {
    //             const rows = await < Promise < ModActionData[] >> this.query(`SELECT * FROM modactions WHERE guildid = ${escape(guildid)} AND casenumber = ${num}`);
    //             if (rows && rows.length > 0) {
    //                 return rows[0];
    //             }
    //             return false;
    //         } catch (error) {
    //             xlg.error(error);
    //             return false;
    //         }
    //     }
    // }

    /**
     * Search for a case by its super id
     */
    async getModActionBySuperId(id: string): Promise<ModActionData | false> {
        try {
            const rows = await <Promise<ModActionData[]>>this.query(`SELECT * FROM modactions WHERE superid = ${escape(id)}`);
            if (rows && rows.length > 0) {
                return rows[0];
            }
            return false;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Get all of the recorded cases for a given user (in which they were the subject)
     */
    async getModActionsByUser(guildid: string, userid: string): Promise<ModActionData[] | false> {
        try {
            const rows = await <Promise<ModActionData[]>>this.query(`SELECT * FROM modactions WHERE guildid = ${escape(guildid)} AND userid = ${escape(userid)}`);
            if (rows && rows.length > 0) {
                return rows;
            }
            return false;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Get all of the recorded cases for a given user (in which they were the subject)
     */
    async getModActionsByUserAndType(guildid: string, userid: string, action: string): Promise<ModActionData[] | false> {
        try {
            const rows = await <Promise<ModActionData[]>>this.query(`SELECT * FROM modactions WHERE guildid = ${escape(guildid)} AND userid = ${escape(userid)} AND type = ${escape(action)}`);
            if (rows && rows.length > 0) {
                return rows;
            }
            return false;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Flexibly query the database of modactions based on parameters set in the query argument object.
     * @param query query selectors
     * @returns modactions based on query
     */
    async getModActions(query: Partial<ModActionData>/*  & { guildid: string } */): Promise<ModActionData[] | false> {
        try {
            const queryOptions = <(keyof Partial<ModActionData>)[]>Object.keys(query);
            if (!queryOptions.length) return [];
            let sql = `SELECT * FROM modactions WHERE`;
            for (let i = 0; i < queryOptions.length; i++) {
                const opt = queryOptions[i];
                const val = query[opt];
                sql += `${i === 0 ? "" : " AND"} \`${opt}\` = ${escape(val)}`;
            }
            sql += ` ORDER BY created DESC`;
            const result = await <Promise<ModActionData[]>>this.query(`${sql}`);
            if (result.length) {
                return result;
            }
            return [];
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Update the data for a modaction. This uses strictly guildid and casenumber to find the action
     */
    async setModAction(data: ModActionEditData<"guildid" | "userid" | "agent">): Promise<InsertionResult | false> {
        try {
            const { guildid, userid, casenumber, type, endtime, agent, summary, notified } = data;// get provided data to log
            let { superid, usertag, agenttag } = data;// make superid mutable
            if (!guildid || !userid || typeof casenumber !== "number") return false;// i was going to have it be ModActionEditData<"guildid" | "userid" | "agent" | "casenumber"> so i wouldn't have to check for the type here, but i realized that the casenumber is added later on in the data construction process so it would be a pain to assign the casenumber right away
            const e = await this.getModActionByGuildCase(guildid, casenumber) || await this.getModActionBySuperId(superid ?? "");// see if there is a preexisting case with sid or casenumber
            if (!superid) {
                superid = uniquid();// generate sid if none is provided
            }

            let sql = ``;
            if (e && e.casenumber === casenumber) {// if a preexisting case was found, edit it
                sql = `UPDATE modactions SET superid = COALESCE(${escape(superid)}, superid), type = COALESCE(${escape(type)}, type), endtime = COALESCE(${escape(endtime)}, endtime), agent = COALESCE(${escape(agent)}, agent), summary = COALESCE(${escape(summary)}, summary), usertag = COALESCE(${escape(usertag)}, usertag), agenttag = COALESCE(${escape(agenttag)}, agenttag), notified = COALESCE(${escape(notified)}, notified) WHERE guildid = ${escape(guildid)} AND casenumber = ${escape(casenumber)}`;
            } else {// else create a new case
                if (!usertag) {
                    usertag = "";
                }
                if (!agenttag) {
                    agenttag = "";
                }
                sql = `INSERT INTO modactions (superid, guildid, userid, casenumber, type, endtime, agent, summary, usertag, agenttag, notified) VALUES (${escape(superid)}, ${escape(guildid)}, ${escape(userid)}, ${escape(casenumber)}, ${escape(type)}, ${escape(endtime)}, ${escape(agent)}, ${escape(summary)}, ${escape(usertag)}, ${escape(agenttag)}, ${escape(notified)})`;
            }
            const result = await <Promise<InsertionResult>>this.query(sql);
            if (!result || !result.affectedRows) {
                return false;
            }
            return result;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Update a user's data. This is global data (opposed to guild data).
     */
    async delModActions(query: ModActionEditData<"guildid">): Promise<InsertionResult | false> {
        try {
            const queryOptions = <(keyof ModActionEditData<"guildid">)[]>Object.keys(query);
            if (!queryOptions.length) return false;
            let sql = `DELETE FROM modactions WHERE`;
            for (let i = 0; i < queryOptions.length; i++) {
                const opt = queryOptions[i];
                const val = query[opt];
                sql += `${i === 0 ? "" : " AND"} \`${opt}\` = ${escape(val)}`;
            }
            const result = await <Promise<InsertionResult>>this.query(sql);
            if (!result || !result.affectedRows) {
                return false;
            }
            return result;
            // const { guildid, userid, casenumber, superid } = query;// get provided data to log
            // if (!guildid || !userid) return false;
            // const e = await this.getModActionByGuildCase(guildid, casenumber) || await this.getModActionBySuperId(superid ?? "");// see if there is a preexisting case with sid or casenumber

            // let sql = ``;
            // if (e && e.casenumber === casenumber) {// if a preexisting case was found, edit it
            //     sql = `DELETE FROM modactions WHERE guildid = ${escape(guildid)} AND casenumber = ${escape(casenumber)}`;
            // }
            // const result = await <Promise<InsertionResult>>this.query(sql);
            // if (!result || !result.affectedRows) {
            //     return false;
            // }
            // return result;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Update a user's data. This is global data (opposed to guild data).
     */
    async massUpdateModActions(query: Partial<ModActionEditData>, values: Partial<ModActionEditData>): Promise<InsertionResult | false> {
        const updateValues = <(keyof ModActionEditData)[]>Object.keys(values);
        if (!updateValues.length) return false;
        let sql = `UPDATE modactions SET`;
        for (let i = 0; i < updateValues.length; i++) {
            const opt = updateValues[i];
            const val = values[opt];
            sql += `${i === 0 ? "" : ","} \`${opt}\` = ${escape(val)}`;
        }
        sql += ` WHERE `;
        const queryOptions = <(keyof ModActionEditData)[]>Object.keys(query);
        if (!queryOptions.length) return false;
        for (let i = 0; i < queryOptions.length; i++) {
            const opt = queryOptions[i];
            const val = query[opt];
            sql += `${i === 0 ? "" : " AND"} \`${opt}\` = ${escape(val)}`;
        }
        console.log(sql)
        const result = await <Promise<InsertionResult>>this.query(sql);
        if (!result || !result.affectedRows) {
            return false;
        }
        return result;
        // const { guildid, userid, casenumber, superid } = query;// get provided data to log
        // if (!guildid || !userid) return false;
        // const e = await this.getModActionByGuildCase(guildid, casenumber) || await this.getModActionBySuperId(superid ?? "");// see if there is a preexisting case with sid or casenumber

        // let sql = ``;
        // if (e && e.casenumber === casenumber) {// if a preexisting case was found, edit it
        //     sql = `DELETE FROM modactions WHERE guildid = ${escape(guildid)} AND casenumber = ${escape(casenumber)}`;
        // }
        // const result = await <Promise<InsertionResult>>this.query(sql);
        // if (!result || !result.affectedRows) {
        //     return false;
        // }
        // return result;
    }

    /**
     * Gets the highest case number recorded in modactions for a guild. This will always return 0 if caselogging is turned off.
     * @param guildid id of guild
     */
    async getHighestCaseNumber(guildid: string): Promise<number> {
        try {
            if (!guildid) return 0;
            const rows = await <Promise<ModActionData[]>>this.query(`SELECT \`casenumber\` FROM modactions WHERE guildid = ${escape(guildid)} AND casenumber > 0 ORDER BY \`casenumber\` DESC LIMIT 1`);
            if (rows && rows.length > 0) {
                return rows[0].casenumber || 0;
            }
            return 0;
        } catch (error) {
            xlg.error(error);
            return 0;
        }
    }

    async getMovementData(guildid: string): Promise<MovementData> {
        try {
            const mvmGS = await this.getGuildSetting(guildid, "movement");
            if (!mvmGS || !mvmGS.value) {
                return { add_channel: "", depart_channel: "", depart_message: { outside: "", embed: {} }, dm_message: { outside: "", embed: {} }, add_message: { outside: "", embed: {} }};
            }
            const mvm = JSON.parse(mvmGS.value);
            const movement: MovementData = { add_channel: "", depart_channel: "", depart_message: { outside: "", embed: {} }, dm_message: { outside: "", embed: {} }, add_message: { outside: "", embed: {} } };
            if (mvm.add_channel) movement.add_channel = mvm.add_channel;
            if (mvm.depart_channel) movement.depart_channel = mvm.depart_channel;
            if (mvm.depart_message) movement.depart_message = mvm.depart_message;
            if (mvm.dm_message) movement.dm_message = mvm.dm_message;
            if (mvm.add_message) movement.add_message = mvm.add_message;
            return movement;
        } catch (error) {
            return { add_channel: "", depart_channel: "", depart_message: { outside: "", embed: {} }, dm_message: { outside: "", embed: {} }, add_message: { outside: "", embed: {} }};
        }
    }

    public defaultCommandConf: CommandConf = {
        name: "",
        enabled: true,
        channel_mode: false,
        channels: [],
        role_mode: false,
        roles: [],
        level: permLevels.member,
        confined: false,
        description: "",
        description_short: "",
        default_cooldown: 0,
        overwrite: false,
    }

    /**
     * Get the full raw command conf stored in the database
     */
    async getCommandConf(guildid: string): Promise<CmdConfEntry | false> {
        try {
            const ccd = await this.getGuildSetting(guildid, 'commandconf');//TODO: this takes at minimum 200ms to resolve, fix that
            let tp = "";
            if (!ccd || !ccd.value) {
                if (ccd && !ccd.value) {
                    await this.editGuildSetting(guildid, "commandconf", undefined, true);
                }
                tp = `{"commands": [], "conf": {}}`;
            } else {
                tp = ccd.value;
            }
            const cc = JSON.parse(tp);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isCmdConf = (o: any): o is CmdConfEntry => {
                return 'commands' in o && 'conf' in o;
            }
            if (!isCmdConf(cc)) {
                await this.editGuildSetting(guildid, "commandconf", undefined, true);
                return false;
            }
            return cc;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Get the full command conf but with additional command list options
     */
    async getCommands(guildid: string, noOwner = false, all = true): Promise<CmdConfEntry | false> {
        try {
            const cc = await this.getCommandConf(guildid);
            if (!cc) return false;
            const commands = cc.commands.filter(x => Bot.client.commands.get(x.name));// there is not an assignment reference here because the .filter() usage creates a new object
            const gc = cc.conf;
            Bot.client.commands.forEach((c) => {
                if (all) {
                    if (!cc.commands.find(x => x.name === c.name)) {
                        const s = Object.assign({}, this.defaultCommandConf);
                        s.name = c.name;
                        if (typeof c.permLevel === "number") {
                            s.level = c.permLevel;
                        }
                        if (typeof c.cooldown === "number") {
                            s.default_cooldown = c.cooldown;
                        }
                        if (c.category) {
                            s.category = c.category;
                        }

                        if (gc.channel_mode) {
                            s.channel_mode = true;
                        }
                        if (gc.channels) {
                            s.channels = gc.channels;
                        }
                        if (gc.role_mode) {
                            s.role_mode = gc.role_mode;
                        }
                        if (gc.roles) {
                            s.roles = gc.roles;
                        }
                        commands.push(s);
                    }
                }
                const conf = commands.find(x => x.name === c.name);
                if (conf) {
                    if (c.description) {
                        if (typeof c.description === "string") {
                            conf.description = c.description;
                            conf.description_short = c.description;
                        } else {
                            conf.description = c.description.long;
                            conf.description_short = c.description.short;
                        }
                    }
                    conf.default_cooldown = c.cooldown || 0;
                    conf.category = c.category;
                    if (typeof conf.cooldown === "number") {
                        if (conf.cooldown < (c.cooldown || 0)) {
                            conf.cooldown = c.cooldown;
                        }
                    } else {
                        conf.cooldown = conf.default_cooldown;
                    }
                    if (conf.category === "owner") {
                        conf.level = permLevels.botMaster;
                    }
                }
            });
            cc.commands = commands;
            if (noOwner) {
                cc.commands = cc.commands.filter((x) => x.category !== "owner");
            }
            return cc;
        } catch (error) {
            xlg.error(error)
            await this.editGuildSetting(guildid, "commandconf", undefined, true);
            return false;
        }
    }

    async getCommand(guildid: string, cmd: string, cc?: CmdConfEntry): Promise<CommandConf | false> {
        try {
            const conf = !cc ? await this.getCommands(guildid, undefined, false) : cc;
            if (!conf) {
                return false;
            }
            const command = conf.commands.find(x => x.name === cmd);
            if (command) {
                return command;
            }
            return false;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    async editCommands(guildid: string, commands: CommandConf[], deleting = false, glob?: CommandsGlobalConf): Promise<boolean> {
        try {
            const conf = await this.getCommands(guildid, undefined, false);
            if (!conf) {
                return false;
            }
            const cmds = conf.commands;
            if (deleting) {
                for (const command of commands) {
                    const existingCommand = cmds.findIndex(x => x.name === command.name);
                    if (existingCommand > -1) {
                        cmds.splice(existingCommand, 1);
                    }
                }
            } else {
                commands.forEach(c => {
                    delete c.description;
                    delete c.description_short;
                    delete c.category;
                    c.overwrite = true;
                    const curr = cmds.find(x => x.name === c.name);
                    if (!curr) {
                        cmds.push(c);
                    } else {
                        cmds.splice(cmds.indexOf(curr), 1, c);
                    }
                });
            }
            if (glob) {
                conf.conf = glob;
            }
            const r = await this.editGuildSetting(guildid, "commandconf", JSON.stringify(conf));
            if (!r.affectedRows) {
                return false;
            }
            return true;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    /**
     * Not in use at the moment
     */
    // async getCommandsGlobalConf(guildid: string): Promise<CommandsGlobalConf> {
    //     try {
    //         const conf = await this.getCommandConf(guildid);
    //         if (!conf) {
    //             return {};
    //         }
    //         return conf.conf;
    //     } catch (error) {
    //         xlg.error(error);
    //         return {};
    //     }
    // }

    async getInvites(query: Partial<InvitedUserData>): Promise<InvitedUserData[]> {
        try {
            const queryOptions = <(keyof Partial<InvitedUserData>)[]>Object.keys(query);
            if (!queryOptions.length) return [];
            let sql = `SELECT * FROM invitetracking WHERE`;
            for (let i = 0; i < queryOptions.length; i++) {
                const opt = queryOptions[i];
                const val = query[opt];
                sql += `${i === 0 ? "" : " AND"} \`${opt}\` = ${escape(val)}`;
            }
            sql += ` ORDER BY inviteat DESC`;
            const result = await <Promise<InvitedUserData[]>>this.query(`${sql}`);
            if (result.length) {
                return result;
            }
            return [];
        } catch (error) {
            xlg.error(error);
            return [];
        }
    }

    async addInvite(guildid: string, user: { id: string, tag: string }, code: string, inviter?: { id: string, tag: string }): Promise<InsertionResult | false> {
        try {
            const inviterid = inviter ? inviter.id : guildid;
            const invitername = inviter ? inviter.tag : "x";
            const userid = user.id;
            const usertag = user.tag;
            const result = await <Promise<InsertionResult>>this.query(`INSERT INTO \`invitetracking\` (guildid, invitee, inviteename, inviter, invitername, code) VALUES (${escape(guildid)}, ${escape(userid)}, ${escape(usertag)}, ${escape(inviterid)}, ${escape(invitername)}, ${escape(code)})`);
            if (result.affectedRows) {
                return result;
            }
            return false;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    async updateInviteInviter(guildid: string, code: string, inviter: { id: string, tag: string }): Promise<InsertionResult | false> {
        try {
            const result = await <Promise<InsertionResult>>this.query(`UPDATE invitetracking SET invitername = ${escape(inviter.tag)}, inviter = ${escape(inviter.id)} WHERE guildid = ${escape(guildid)} AND code = ${escape(code)}`);
            if (result.affectedRows) {
                return result;
            }
            return false;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    async deleteInvites(query: Partial<InvitedUserData>): Promise<InsertionResult | false> {
        try {
            const queryOptions = <(keyof Partial<InvitedUserData>)[]>Object.keys(query);
            if (!queryOptions.length) return false;
            let sql = `DELETE FROM invitetracking WHERE`;
            for (let i = 0; i < queryOptions.length; i++) {
                const opt = queryOptions[i];
                const val = query[opt];
                sql += `${i === 0 ? "" : " AND"} \`${opt}\` = ${escape(val)}`;
            }
            const result = await <Promise<InsertionResult>>this.query(`${sql}`);
            return result;
        } catch (error) {
            xlg.error(error);
            return false;
        }
    }

    async getStoredPresence(bypassDefault = false): Promise<StoredPresenceData> {
        const r = await this.getGlobalSetting("presence");
        const presenceDefault: StoredPresenceData = {
            status: `online`,
            type: `WATCHING`,
            name: `${config.prefix} help | ${config.prefix} invite`,
            useDefault: false,
        };
        if (r) {
            const parsed = JSON.parse(r.value);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isStoredPresence = (o: any): o is StoredPresenceData => {
                return 'status' in o && 'type' in o && 'name' in o;
            }
            if (isStoredPresence(parsed)) {
                if (!bypassDefault && parsed.useDefault) {
                    return presenceDefault;
                }
                return parsed;
            }
        }
        return presenceDefault;
    }

    async setStoredPresence(d: StoredPresenceData, updater: User): Promise<InsertionResult | false> {
        if (!updater) return false;
        const r = await this.editGlobalSettings('name', "presence", updater, JSON.stringify(d).escapeSpecialChars());
        if (r.affectedRows) {
            return r;
        }
        return false;
    }

    async getStarboardSetting(gid: Snowflake): Promise<Starboard> {
        const r = await this.getGuildSetting(gid, "starboard");
        if (r) {
            const j = JSON.parse(r.value);// assuming that the data is a starboard setting
            const s = new Starboard(j);
            return s;
        } else {
            const s = new Starboard();
            return s;
        }
    }

    async setStarboard(gid: Snowflake, d: Starboard): Promise<InsertionResult> {
        const r = await this.editGuildSetting(gid, "starboard", JSON.stringify(d).escapeSpecialChars());
        return r;
    }

    async getStarredMessage(mid: Snowflake): Promise<StarredMessageData | false> {
        const r = await <Promise<StarredMessageData[]>>this.query(`SELECT * FROM starboard WHERE messageid = ${escape(mid)}`);
        if (r.length) {
            const s1 = r[0];
            return s1;
        }
        return false;
    }

    //TODO: add queryStarredMessages()

    async setStarredMessage(d: StarredMessageData): Promise<InsertionResult> {
        const { messageid, channelid, guildid, authorid, stars, nsfw, locked, postid, postchannel } = d;
        const sql = `INSERT INTO starboard (messageid, guildid, channelid, authorid, stars, nsfw, locked, postid, postchannel) VALUES (${escape(messageid)}, ${escape(guildid)}, ${escape(channelid)}, ${escape(authorid)}, ${escape(stars)}, ${escape(nsfw)}, ${escape(locked)}, ${escape(postid)}, ${escape(postchannel)}) ON DUPLICATE KEY UPDATE guildid = COALESCE(${escape(guildid)}, guildid), authorid = COALESCE(${escape(authorid)}, authorid), channelid = COALESCE(${escape(channelid)}, channelid), stars = COALESCE(${escape(stars)}, stars), nsfw = COALESCE(${nsfw}, nsfw), locked = COALESCE(${escape(locked)}, locked), postid = COALESCE(${escape(postid)}, postid), postchannel = COALESCE(${escape(postchannel)}, postchannel)`;
        const r = await <Promise<InsertionResult>>this.query(sql);
        return r;
    }
}
