import moment from 'moment';
import { ClientValuesGuild, DashboardMessage, SkeletonGuildObject, XClient } from '../gm';
import { Channel, MessageEmbed, MessageEmbedOptions, Snowflake, TextChannel } from 'discord.js';
import { Bot } from "../bot";
import Client from '../struct/Client';
import { combineEmbedText } from './parsers';

export async function sendModerationDisabled(channel: Channel): Promise<void> {
    try {
        if (!channel.isText() || !('guild' in channel)) return;
        const fail_embed_color = await Bot.client.database.getColor("fail");
        channel.send({
            embed: {
                color: fail_embed_color,
                description: `Server moderation in ${channel.guild.name.escapeDiscord()} is currently disabled. Admins must enable moderation features with \`settings moderation enable\`.`
            }
        });
    } catch (error) {
        xlg.error(error);
    }
}

export async function sendError(channel: Channel, message?: string, errorTitle: string | boolean = false): Promise<void> {
    try {
        if (!channel.isText()) return;
        await channel.send({
            embed: {
                color: await Bot.client.database.getColor("fail") || 16711680,
                title: errorTitle ? typeof errorTitle === "string" ? errorTitle : "Error" : undefined,
                description: (message && message.length) ? message : "Something went wrong. ¯\\_(ツ)_/¯"
            }
        });
        return;
    } catch (error) {
        xlg.error(error);
    }
}

export async function sendInfo(channel: Channel, message: string): Promise<void> {
    try {
        if (!channel.isText()) return;
        channel.send({
            embed: {
                color: 0x337fd5/* await Bot.client.database.getColor("info") */,
                description: `<:sminfo:818342088088354866> ${message}`
            }
        });
        return;
    } catch (error) {
        xlg.error(error);
    }
}

export async function argsNumRequire(channel: Channel, args: string[], num: number): Promise<boolean> {
    try {
        if (!channel.isText()) return false;
        if (args.length == num) return true;
        const fail_embed_color = await Bot.client.database.getColor("fail");
        channel.send({
            embed: {
                color: fail_embed_color,
                description: `The wrong number of arguments was provided.\nThis command requires \` ${num} \` arguments.`
            }
        });
        return false;
    } catch (error) {
        xlg.error(error);
        return false;
    }
}

export async function argsMustBeNum(channel: Channel, args: string[]): Promise<boolean> {
    try {
        if (!channel.isText()) return false;
        if (!args || !args.length) return false;
        let forResult = true;
        const invalid: string[] = [];// there should only really be one or zero entries
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (!/^[0-9]+(?:\.[0-9]+)?$/.test(arg)) {
                forResult = false;
                invalid.push(arg);
                break;
            }
            const nr = parseInt(arg, 10);
            if (isNaN(nr)) {
                forResult = false;
                invalid.push(arg);
                break;
            }
        }
        if (!forResult) {
            await channel.send({
                embed: {
                    color: await Bot.client.database.getColor("fail"),
                    title: "Invalid Arguments",
                    description: `Some or all arguments must be numbers (floating or integer)\nYou sent: \` ${invalid.map(x => x.escapeDiscord()).join(", ")} \``,
                }
            });
            return false;
        }
        return true;
    } catch (error) {
        xlg.error(error);
        return false;
    }
}

export function timedMessagesHandler(client: XClient): void {
    setInterval(async () => {
        if (moment().utcOffset(-5).format('M/D HH:mm') == "9/26 21:30") {
            const pcr = await client.database.getGlobalSetting('primchan');
            const primchan = pcr ? await client.channels.fetch(pcr.value as Snowflake) : false;
            if (primchan instanceof TextChannel) {
                primchan.send('happy birthday');
            }
        }
        if (moment().utcOffset(-6).format('M/D HH:mm') == "1/1 00:00") {
            const pcr = await client.database.getGlobalSetting('primchan');
            const primchan = pcr ? await client.channels.fetch(pcr.value as Snowflake) : false;
            if (primchan instanceof TextChannel) {
                primchan.send("Welcome to the New Year (CST) @everyone");
            }
        }
    }, 60000);
}

/*interface MemTypes {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
    arrayBuffers: string;
}*/

export function memoryUsage(): string {
    const memTypes = {
        "rss": "RSS ---------------",
        "heapTotal": "HeapTotal ---------",
        "heapUsed": "HeapUsed ----------",
        "external": "External ----------",
        "arrayBuffers": "ArrayBuffers ------"
    };
    return Object.entries(process.memoryUsage()).map(usage => {
        const u = usage[0];
        if (u !== "rss" && u !== "heapTotal" && u !== "heapUsed" && u !== "external" && u !== "arrayBuffers") return;
        const r = (Math.round(usage[1] / 1024 / 1024 * 100) / 100).toFixed().split('.')[0];
        return `${memTypes[u]} ${r}MB`
    }).join("\n");
}

// iannis
/*export function delayedLoop(callback: (arg0: number) => void, start = 0, end = 1, increment = 1, delay = 0): void {
    let i = start;

    const iteration = () => {
        callback(i);
        i += increment;
        if (i < end) setTimeout(iteration, delay);
    }

    iteration();
}*/

/**
 * Get an accurate and universal link to the web dashboard
 */
export function getDashboardLink(guildid?: string, mod?: string): string {
    return `${process.env.DASHBOARD_HOST}/dash/${guildid}${guildid && mod ? `/${mod}` : ""}`
}

/**
 * Get the base URI for the website
 */
export function getBackendRoot(): string {
    return process.env.NODE_ENV === "dev" ? 'http://localhost:3005' : `https://stratum.hauge.rocks`;
}


/**
 * Get the true link to the support server
 */
export function getSupportServer(embed = false): string {
    const link = `https://discord.gg/AvXvvSg`;
    return embed ? `[support server](${link})` : `${link}`;
}

export function isSnowflake(o: string): o is Snowflake {
    return (/^[0-9]{18}$/.test(o));
}

export const shards = {
    /**
     * Send a message through all of the sharded clients that will send from the client that has the desired channel
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendMessageAll(m: Record < string, any >, cid: string): void {
        Bot.client.shard?.broadcastEval(`
const c = this.channels.cache.get('${cid}');
if (c && c.send) {
    c.send(${JSON.stringify(m)})
}
    `);
    },
    /**
     * Retrieves all of the guilds that belonging to a client if the client is sharded. It will asynchronously fetch all guilds from each of the shards and reduce them to one array. The values returned from the shards are not normal guild objects. They are reduced guild object.
     * @param client the client to retrieve the guilds from
     * @returns all guilds cached in the client's shards
     */
    async getAllGuilds(): Promise<ClientValuesGuild[] | false> {
        if (!Bot.client.shard) {
            return false;
        }
        const reductionFunc = (p: ClientValuesGuild[], c: ClientValuesGuild[]) => {
            for (const bg of c) {
                p.push(bg);
            }
            return p;
        };
        const values = await <Promise<ClientValuesGuild[][]>>Bot.client.shard.fetchClientValues("guilds.cache");
        if (!values) {
            return false;
        }
        const guilds = values.reduce(reductionFunc, <ClientValuesGuild[]>[]);
        if (!guilds) {
            return false;
        }
        return guilds;
    },
    async getAllChannels(): Promise<Channel[] | false> {
        if (!Bot.client.shard) {
            return false;
        }
        const reductionFunc = (p: Channel[], c: Channel[]) => {
            for (const chan of c) {
                p.push(chan);
            }
            return p;
        };
        const channels = (await Bot.client.shard.fetchClientValues("channels.cache"))?.reduce(reductionFunc, []);
        if (!channels) {
            return false;
        }
        return channels;
    },
    async getMutualGuilds(uid: Snowflake): Promise<SkeletonGuildObject[] | false> {
        if (!Bot.client.shard) {
            return false;
        }
        const getMutual = async function (c: Client, id: Snowflake): Promise<SkeletonGuildObject[] | void> {
            try {
                const mutualGuilds: SkeletonGuildObject[] = c.guilds.cache.filter(x => !!x.members.cache.get(id)).map(x => {
                    return {
                        name: x.name,
                        id: x.id,
                        icon: x.iconURL(),
                        owner: x.ownerID,
                    }
                });
                return mutualGuilds;
            } catch (error) {
                //
            }
        };
        const r: (SkeletonGuildObject[] | void)[] = await Bot.client.shard.broadcastEval(`(${getMutual})(this, '${uid}')`);
        const mut: SkeletonGuildObject[] = [];
        for (const ga of r) {
            if (ga) {
                for (const g of ga) {
                    mut.push(g);
                }
            }
        }
        return mut;
        // return false;
    },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDashboardMessage(o: Record<string, any>): o is DashboardMessage {
    return typeof o.add_channel === "string"
        && typeof o.dm_channel === "string"
        && typeof o.depart_channel === "string"
        && 'add_message' in o
        && 'dm_message' in o
        && 'depart_message' in o;
}

type MC = { content: string | undefined, embed: MessageEmbed | undefined };
export function assembleDashboardMessage(m: DashboardMessage): MC {
    const e: MessageEmbedOptions = {
        author: {
            iconURL: m.embed.authoricon,
            name: m.embed.authorname,
        },
        thumbnail: {
            url: m.embed.thumbnailurl,
        },
        color: m.embed.color,
        url: m.embed.url,
        timestamp: m.embed.timestamp,
        title: m.embed.title,
        description: m.embed.description,
        fields: m.embed.fields,
        image: {
            url: m.embed.imageurl,
        },
        video: {
            url: m.embed.videourl,
        },
        footer: {
            text: m.embed.footertext,
            iconURL: m.embed.footericon,
        },
    };
    return {
        content: m.outside || undefined,
        embed: combineEmbedText(e).length ? new MessageEmbed(e) : undefined,
    };
}
