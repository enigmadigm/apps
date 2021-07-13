import { permLevels } from '../../permissions';
import { Command } from "src/gm";
import { isSnowflake } from '../../utils/specials';
import { unban } from '../../utils/modactions';

export const command: Command = {
    name: "unban",
    aliases: ["ub"],
    description: {
        short: "unban one or all users",
        long: "Use to unban a banned member or all banned members. This will remove their server ban, if one exists. It will also remove users from the autoban list."
    },
    usage: "<user id | all>",
    args: 1,
    permLevel: permLevels.mod,
    guildOnly: true,
    moderation: true,
    permissions: ["BAN_MEMBERS", "MANAGE_GUILD"],
    async execute(client, message, args) {
        try {
            const a = args.join(" ");
            await message.guild.bans.fetch();
            if (a === "all") {
                let bc = 0;
                const storedBans = await client.database.getGuildSetting(message.guild, "toban");
                if (storedBans) {
                    try {
                        const bans: string[] = JSON.parse(storedBans.value);
                        if (bans.length) {
                            bc += bans.length;
                            await client.database.editGuildSetting(message.guild, "toban", "[]");
                        }
                    } catch (error) {
                        xlg.error(error);
                    }
                }
                const b = message.guild.bans.cache;
                if (!bc && !b.size) {
                    await client.specials.sendError(message.channel, `No bans found`);
                    return;
                }
                const ba = b.array();
                for (let i = 0; i < ba.length; i++) {
                    const c = ba[i];
                    // await message.guild.members.unban(c.user);
                    await unban(client, message.guild, c.user, message.member, `UNBAN ALL action requested by ${message.author.tag}`);
                    bc++;
                }
                await message.channel.send(`\\✅ ${bc} users unbanned`);
                return;
            }

            const t = args[0];
            const ub = message.guild.bans.cache.find(x => x.user.id === t || x.user.tag === t);//TODO: add function to specials to search all shards for a user and return the userinfo, like the id, if they are found, this could be used to search using tags because with a tag a user in a mutual guild could be found
            if (!ub && !isSnowflake(t)) {// if they provided a tag (or something) and the use wasn't found
                await client.specials?.sendError(message.channel, "A valid user ID (Snowflake) is required");
                return;
            }
            if (!ub) {
                const storedBans = await client.database.getGuildSetting(message.guild, "toban");
                if (storedBans) {
                    try {
                        const bans: string[] = JSON.parse(storedBans.value);
                        if (bans.includes(t)) {
                            bans.splice(bans.indexOf(t), 1);
                            await client.database.editGuildSetting(message.guild, "toban", JSON.stringify(bans).escapeSpecialChars());
                            await message.channel.send(`That ID was found and removed from the autoban list.`);
                            return;
                        }
                    } catch (error) {
                        xlg.error(error);
                    }
                }
    
                await client.specials.sendError(message.channel, "There is no banned user matching that ID");
                return;
            }

            args.shift();// shift the target argument
            const reason = args.join(" ");
            try {
                const unbanResult = await unban(client, message.guild, ub.user, message.member, reason);
                if (unbanResult) {
                    await message.channel.send(unbanResult);
                    return;
                }
            } catch (e) {
                //
            }
            await message.channel.send(`\\🆘 Could not unban ${ub.user.tag}`);
        } catch (error) {
            xlg.error(error);
            await client.specials.sendError(message.channel);
            return false;
        }
    }
}
