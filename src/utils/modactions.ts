import { Guild, GuildMember, MessageEmbedOptions, Permissions, User } from "discord.js";
import moment from "moment";
import { UnbanAction, UnmuteAction, WarnConf, XClient } from "../gm";
import { durationToString } from "./parsers";
import uniqid from 'uniqid';
import { Contraventions } from "./contraventions";
import { isSnowflake } from "./specials";

// export class BaseModAction<T> {
//     public client: XClient;
//     public mod: string;
//     public target: GuildMember;
//     public time: number;
//     public duration = "";

//     constructor(type: string, client: XClient, target: GuildMember, time = 0, mod?: string) {
//         this.client = client;
//         this.mod = mod || this.client.user?.tag || "0";
//         this.target = target;
//         this.time = time;

//         if (this.time) {
//             this.duration = durationToString(this.time);
//             //mendm = ` for ${dur}`
//         }
//     }

//     setTime(n: number): void {
//         this.time = n;

//         if (this.time) {
//             this.duration = durationToString(this.time);
//             //mendm = ` for ${dur}`
//         }
//     }

//     setMod(m: string): void {
//         this.mod = m;
//     }

//     public async set(data: T): Promise<boolean> {
//         if (this.client.database) {
//             if (this.time) {
//                 const t = moment().add(this.time, "ms").toDate();
//                 const r = await this.client.database.setAction(uniqid(), t, "unmute", data);
//                 if (!r) {
//                     return false;
//                 }
//             }
//             return true;
//         } else {
//             return false;
//         }
//     }
// }

// export class Mute extends BaseModAction<UnmuteActionData> {
//     public mutedRole?: Role;

//     /**
//      * @param client bot client
//      * @param target target to take action on
//      * @param time time in seconds
//      * @param mod moderator string
//      */
//     constructor(client: XClient, target: GuildMember, time?: number, mod?: string) {
//         super("unmute", client, target, time, mod);
//     }

//     public async setup(): Promise<void> {
//         const dbmr = await this.client.database.getGuildSetting(this.target.guild, "mutedrole");
//         const mutedRoleID = dbmr ? dbmr.value : "";
//         // Check if the guild has the mutedRole
//         this.mutedRole = this.target.guild.roles.cache.find(r => r.id === mutedRoleID || r.name.toLowerCase() === 'muted' || r.name.toLowerCase() === 'mute');
//         // If the guild does not have the muted role execute the following

//         if (!this.mutedRole) {
//             // Create a role called "Muted"
//             this.mutedRole = await this.target.guild.roles.create({
//                 data: {
//                     name: 'Muted',
//                     color: '#708090',
//                     permissions: 0,
//                     position: 1
//                 }
//             });

//             this.client.database.editGuildSetting(this.target.guild, "mutedrole", this.mutedRole.id);

//             // Prevent the user from sending messages or reacting to messages
//             this.target.guild.channels.cache.each(async (channel) => {
//                 if (this.mutedRole) {
//                     await channel.updateOverwrite(this.mutedRole, {
//                         SEND_MESSAGES: false,
//                         ADD_REACTIONS: false
//                     });
//                 }
//             });
//         }
//         if (this.mutedRole.position < this.target.roles.highest.position) {
//             this.mutedRole.setPosition(this.target.roles.highest.position);
//         }

//         // If the mentioned user already has the "mutedRole" then that can not be muted again
//         if (this.target.roles.cache.has(this.mutedRole.id)) {
//             //message.channel.send(`\`${target.user.tag}\` is already muted`);
//             return;
//         }

//         await this.target.roles.add(this.mutedRole, `muted by ${this.mod}`).catch(e => console.log(e.stack));
//         if (this.target.voice.connection && !this.target.voice.mute) {
//             await this.target.voice.setMute(true);
//         }

//         //message.channel.send(`<a:spinning_light00:680291499904073739>\\✅ Muted \`${toMute.user.tag}\`${mendm}`);

//         if (this.time) {
//             /*setTimeout(async () => {
//                 if (mutedRole) {
//                     if (!toMute.roles.cache.has(mutedRole.id)) return;
//                     // Remove the mentioned users role "mutedRole", "muted.json", and notify command sender
//                     await toMute.roles.remove(mutedRole, `unmuting automatically after ${dur}`);
//                     if (toMute.voice.connection && toMute.voice.mute) {
//                         toMute.voice.setMute(false);
//                     }
//                 }
//             }, time)*/
//             const data: UnmuteActionData = {
//                 guildid: this.target.guild.id,
//                 userid: this.target.id,
//                 roleid: this.mutedRole.id,
//                 duration: this.duration
//             }
//             await this.set(data);
//         }
//     }
// }

/**
 * Auto-mute a target permanently or for a period
 */
export async function mute(client: XClient, target: GuildMember, time = 0, mod: GuildMember | string, reason = "Automatic mute", remute = false): Promise<void | string> {
    if (!target.guild.me?.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) return;
    const modtag = mod instanceof GuildMember ? mod.user.tag : mod === client.user?.id ? client.user?.tag : isSnowflake(mod) ? target.guild.members.cache.get(mod)?.user.tag || "" : "";

    const dbmr = await client.database.getGuildSetting(target.guild, "mutedrole");
    const mutedRoleID = dbmr ? dbmr.value : "";
    // Check if the guild has the mutedRole
    let mutedRole = target.guild.roles.cache.find(r => r.id === mutedRoleID || r.name.toLowerCase() === 'muted' || r.name.toLowerCase() === 'mute');
    // If the guild does not have the muted role execute the following

    if (!mutedRole) {
        // Create a role called "Muted"
        mutedRole = await target.guild.roles.create({
            name: 'Muted',
            color: '#708090',
            permissions: 0n,
            position: 1
        });

        client.database.editGuildSetting(target.guild, "mutedrole", mutedRole.id);

        // Prevent the user from sending messages or reacting to messages
        target.guild.channels.cache.each(async (channel) => {
            if (mutedRole && !channel.isThread()) {
                await channel.updateOverwrite(mutedRole, {
                    SEND_MESSAGES: false,
                    ADD_REACTIONS: false
                });
            }
        });
    } else {
        if (mutedRole.id !== mutedRoleID) {
            client.database.editGuildSetting(target.guild, "mutedrole", mutedRole.id);
        }
    }
    if (mutedRole.position < target.roles.highest.position) {
        mutedRole.setPosition(target.roles.highest.position);
    }

    // If the mentioned user already has the "mutedRole" then that can not be muted again
    if (target.roles.cache.has(mutedRole.id)) {
        return `\`${target.user.tag}\` is already muted`;
    }

    await target.roles.add(mutedRole, `Requested by ${modtag}${reason ? ` for ${reason}` : ""}`).catch(e => console.log(e.stack));
    if (target.voice.channel && !target.voice.serverMute) {
        try {
            await target.voice.setMute(true);
        } catch (error) {
            xlg.error("modactions error setting voice mute", error)
        }
    }
    let duration = "";
    let mendm = "";
    if (time) {
        duration = durationToString(time);
        mendm = ` for ${duration}`
    }

    let noNotify = false;
    try {
        let embed: MessageEmbedOptions = {};
        if (!remute) {
            embed = {
                color: await client.database.getColor("fail"),
                title: `Mute Notice`,
                description: `You were **muted** in \`${target.guild.name.escapeDiscord()}\`.${time ? `\nThis is a temporary mute, it will end in ${duration} at \`${moment().add(time, "ms").format('YYYY-MM-DD HH:mm:ss')}\`.` : ""}`,
                fields: [
                    {
                        name: "Reason",
                        value: `${reason || "*none*"}`,
                    }
                ],
            };
            if (modtag) {
                embed.fields?.push({
                    name: "Moderator",
                    value: `${modtag}`,
                });
            }
        } else {
            embed = {
                color: await client.database.getColor("warn"),
                title: `Remute`,
                description: `**Re:** \`${target.guild.name.escapeDiscord()}\`\nYou either intentionally or unintentionally tried to evade your mute. It has been reinstated.`,
            };
        }
        await target.send({ embeds: [embed] });
    } catch (error) {
        noNotify = true;
    }

    await Contraventions.logMute(target, time, mod, `${reason}`, remute, noNotify ? true : false);

    if (time) {
        /*setTimeout(async () => {
            if (mutedRole) {
                if (!toMute.roles.cache.has(mutedRole.id)) return;
                // Remove the mentioned users role "mutedRole", "muted.json", and notify command sender
                await toMute.roles.remove(mutedRole, `unmuting automatically after ${dur}`);
                if (toMute.voice.connection && toMute.voice.mute) {
                    toMute.voice.setMute(false);
                }
            }
        }, time)*/
        const data: UnmuteAction["data"] = {
            guildid: target.guild.id,
            userid: target.id,
            roleid: mutedRole.id,
            duration: duration
        }

        if (client.database) {
            if (time) {
                const t = moment().add(time, "ms").toDate();
                await client.database.setAction(uniqid(), t, "unmute", data);
            }
        }
        //await set(data);
    }

    return `\\✅ Muted \`${target.user.tag}\`${mendm}`;
}

/**
 * Ban a target permanently or for a period.
 */
export async function ban(client: XClient, target: GuildMember, time = 0, mod: GuildMember | string, summary?: string): Promise<void | string> {
    if (!client.database || !target.bannable) return;
    const modtag = mod instanceof GuildMember ? mod.user.tag : mod === client.user?.id ? client.user?.tag : isSnowflake(mod) ? target.guild.members.cache.get(mod)?.user.tag || "" : "";
    
    let duration = "";
    let mendm = "";
    if (time) {
        duration = durationToString(time);
        mendm = ` for ${duration}`
    }

    let noNotify = false;
    try {
        const embed: MessageEmbedOptions = {
            color: await client.database.getColor("fail"),
            title: `Ban Notice`,
            description: `You were **banned** from \`${target.guild.name}\`.${time ? `\nThis is a temporary ban, it will end in ${duration}.` : ""}`,
            fields: [
                {
                    name: "Reason",
                    value: `${summary || "*none*"}`,
                }
            ],
        };
        if (modtag) {
            embed.fields?.push({
                name: "Moderator",
                value: `${modtag}`,
            });
        }
        await target.send({ embeds: [embed] });
        
    } catch (error) {
        noNotify = true;
    }

    // actually ban them
    await target.ban({
        reason: `Requested by ${modtag}${summary ? ` for ${summary}` : ``}`
    });

    await Contraventions.logBan(target, mod, `${summary ? summary : ``}`, time, noNotify ? true : false);

    if (time) {
        const data: UnbanAction["data"] = {
            guildid: target.guild.id,
            userid: target.id,
            duration: duration,
        };
        
        if (client.database) {
            const t = moment().add(time, "ms").toDate();
            await client.database.setAction(uniqid(), t, "unban", data);
        }
    }

    await registerBan(client, target);

    return `\\✅ Banned \`${target.user.tag}\`${mendm}`;
}

export async function registerBan(client: XClient, target: GuildMember): Promise<void> {//TODO: the ban counter is currently unused, but I added this in case I wanted to do a future feature where users would get flagged by automod if they had a significant number of bans
    if (!client.database) return;
    const pud = await client.database.getUserData(target.id);
    const gud = await client.database.getGuildUserData(target.guild.id, target.id);
    if (!pud.bans) {
        pud.bans = 1;
    } else {
        pud.bans++;
    }
    if (gud.bans) {
        gud.bans++;
    } else {
        gud.bans = 1;
    }
    await client.database.updateUserData(pud);
    await client.database.updateGuildUserData(gud);
}

/**
 * Unban a user from a guild
 */
export async function unban(client: XClient, guild: Guild, target: User, mod: GuildMember | string, summary?: string): Promise<void | string> {
    if (!client.database || !client.user) return;
    const modtag = mod instanceof GuildMember ? mod.user.tag : mod === client.user.id ? client.user.tag : isSnowflake(mod) ? guild.members.cache.get(mod)?.user.tag || "" : "";

    let noNotify = false;
    try {
        const embed: MessageEmbedOptions = {
            color: await client.database.getColor("success"),
            title: `Unbab Notice`,
            description: `You were **unbanned** from \`${guild.name}\`.    `,
            fields: [
                {
                    name: "Reason",
                    value: `${summary || "*none*"}`,
                }
            ],
        };
        if (modtag) {
            embed.fields?.push({
                name: "Moderator",
                value: `${modtag}`,
            });
        }
        await target.send({ embeds: [embed] });
    } catch (error) {
        noNotify = true;
    }

    try {
        await guild.members.unban(target, summary);
    } catch (e) {
        return `\\🆘 Could not unban ${target.tag}`
    }
    
    await Contraventions.logUnban(guild.id, target.id, mod, `${summary ? summary : ``}`, target.tag, noNotify ? true : false);
    return `\\✅ Unbanned ${target.tag}`;
}

/**
 * Kick someone
 */
export async function kick(client: XClient, target: GuildMember, mod: GuildMember | string, summary?: string): Promise<void | string> {
    if (!client.database || !target.kickable) return;
    const modtag = mod instanceof GuildMember ? mod.user.tag : mod === client.user?.id ? client.user?.tag : isSnowflake(mod) ? target.guild.members.cache.get(mod)?.user.tag || "" : "";

    let noNotify = false;
    try {
        const embed: MessageEmbedOptions = {
            color: await client.database.getColor("warn_embed_color"),
            title: `Kick Notice`,
            description: `You were **kicked** from \`${target.guild.name}\`.`,
            fields: [
                {
                    name: "Reason",
                    value: `${summary || "*none*"}`,
                }
            ],
        };
        if (modtag) {
            embed.fields?.push({
                name: "Moderator",
                value: `${modtag}`,
            });
        }
        await target.send({ embeds: [embed] });
    } catch (error) {
        noNotify = true;
    }

    await target.kick(`Requested by ${modtag}${summary ? ` for ${summary}` : ``}`);
    await Contraventions.logKick(target, mod, `${summary ? summary : ``}`, noNotify ? true : false);
    return `\\✅ Kicked ${target.user.tag}`;
}

/**
 * Kick someone
 */
export async function warn(client: XClient, target: GuildMember, mod: GuildMember | string, summary?: string): Promise<void | string> {
    if (!client.database) return;
    const modtag = mod instanceof GuildMember ? mod.user.tag : mod === client.user?.id ? client.user?.tag : isSnowflake(mod) ? target.guild.members.cache.get(mod)?.user.tag || "" : "";

    let noNotify = false;
    try {
        const embed: MessageEmbedOptions = {
            color: await client.database.getColor("warn_embed_color"),
            title: `Warn Notice`,
            description: `You were **warned** in \`${target.guild.name}\`.`,
            fields: [
                {
                    name: "Reason",
                    value: `${summary || "*none*"}`,
                }
            ],
        }
        if (modtag) {
            embed.fields?.push({
                name: "Moderator",
                value: `${modtag}`,
            });
        }
        await target.send({ embeds: [embed] });
    } catch (error) {
        noNotify = true;
    }

    await Contraventions.logWarn(target, mod, `${summary ? summary : ``}`, noNotify ? true : false);

    checkWarnings(client, target);

    return `\\✅ ${target} has been warned`;
}

export async function checkWarnings(client: XClient, target: GuildMember): Promise<void> {
    try {
        if (!client.database || !target.bannable || !target.kickable || !target.guild.me) return;

        // const memberCases = await client.database.getModActionsByUser(target.guild.id, target.id);
        // if (!memberCases || !memberCases.length) return;
        const warnCases = await client.database.getModActionsByUserAndType(target.guild.id, target.id, "warn");
        if (!warnCases || !warnCases.length) return;

        const warnConfig = await client.database.getGuildSetting(target.guild, "warnconfig");
        if (!warnConfig) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let conf: WarnConf = {};
        try {
            conf = JSON.parse(warnConfig.value);
        } catch (error) {
            //
        }
        if (typeof conf.threshold !== "number" || typeof conf.punishment !== "string" || !conf.punishment) {
            await client.database.editGuildSetting(target.guild, "warnconfig", undefined, true);
            return;
        }
        if (conf.threshold === -1) {
            return;
        }

        const overWarnLimit = warnCases.length > conf.threshold;
        let ptime = 0;
        if (conf.time && typeof conf.time === "number") {
            ptime = conf.time;
        }
        // const warnPunishmentResult = await client.database.getGuildSetting(target.guild.id, "warnpunishment");
        // const warnPunishment = warnPunishmentResult ? warnPunishmentResult.value : "";
        if (overWarnLimit && target.bannable && target.kickable) {
            switch (conf.punishment) {
                case "ban": {
                    await ban(client, target, 0, target.guild.me, `The user's warnings exceeded the configured threshold. They were banned automatically.`);
                    break;
                }
                case "kick": {
                    await kick(client, target, target.guild.me, `The user's warnings exceeded the configured threshold. They were kicked automatically.`);
                    break;
                }
                case "mute": {
                    await mute(client, target, 0, target.guild.me, `The user's warnings exceeded the configured threshold. They were muted automatically.`);
                    break;
                }
                case "tempban": {
                    await ban(client, target, ptime * 1000, target.guild.me, `The user's warnings exceeded the configured threshold. They were banned automatically.`);
                    break;
                }
                case "tempmute": {
                    await mute(client, target, ptime * 1000, target.guild.me, `The user's warnings exceeded the configured threshold. They were muted automatically.`);
                    break;
                }
                default:
                    conf.punishment = undefined;
                    await client.database.editGuildSetting(target.guild, "warnconfig", JSON.stringify(conf));
                    break;
            }
        }
    } catch (error) {
        xlg.error(error);
    }
}
