import { permLevels } from '../../permissions';
import { stringToMember } from "../../utils/parsers";
import Discord from 'discord.js';
import { Command } from "src/gm";
import { stringToDuration } from "../../utils/time";
import { ban } from "../../utils/modactions";

export const command: Command = {
    name: "ban",
    aliases: ["b"],
    description: {
        short: "ban a member",
        long: "Use to permanently ban a member. This will kick and prevent them from rejoining the server."
    },
    usage: "<member> [reason]",
    args: true,
    permLevel: permLevels.mod,
    guildOnly: true,
    moderation: true,
    permissions: ["BAN_MEMBERS"],
    async execute(client, message, args) {
        try {
            const target = await stringToMember(message.guild, args[0], false, false, false);
            if (!target || !(target instanceof Discord.GuildMember)) {
                if (/^[0-9]{18}$/g.test(args[0])) {
                    const storedBans = await client.database.getGuildSetting(message.guild, "toban") || {value: "[]"};
                    const bans: string[] = JSON.parse(storedBans.value);
                    if (bans.includes(args[0])) {
                        client.specials.sendError(message.channel, `A member with that ID could not be found, but that ID already exists in the autoban list.`);
                        return;
                    }
                    bans.push(args[0]);
                    await client.database.editGuildSetting(message.guild, "toban", JSON.stringify(bans).escapeSpecialChars());
                    await message.channel.send(`User with ID ${args[0]} added to autoban list`);
                    return;
                }
                await client.specials.sendError(message.channel, "That target could not be found, it may not be a member.\nTo ban a member that has left, send their ID.");
                return;
            }
            if (target.id === client.user?.id) {
                await message.channel.send("What if I said I won't let you ban me?");
                return;
            }
            if (!target.bannable) {
                await client.specials.sendError(message.channel, `I can't ban ${target}`);
                return;
            }
            if (target.id === message.author.id) {
                await message.channel.send('You cannot ban yourself');
                return;
            }
            const dbmr = await client.database.getGuildSetting(message.guild, "mutedrole");
            const mutedRoleID = dbmr ? dbmr.value : "";
            if ((target.roles.cache.filter(r => r.id !== mutedRoleID).sort((a, b) => a.position - b.position).first()?.position || 0) >= message.member.roles.highest.position && message.guild.ownerID !== message.member.id) {
                await message.channel.send('You cannot ban a member that is equal to or higher than yourself');
                return;
            }
            args.shift();

            let time = 0;
            if (args[0]) {
                time = stringToDuration(args[0])
            }
            if (time) {
                args.shift();
            }

            const reason = args.join(" ");
            try {
                const banResult = await ban(client, target, time, message.member, reason);
                if (banResult) {
                    await message.channel.send(banResult);
                    return;
                }
            } catch (e) {
                //
            }
            await message.channel.send(`\\🆘 Could not ban ${target.user.tag}`);
        } catch (error) {
            xlg.error(error);
            await client.specials.sendError(message.channel);
            return false;
        }
    }
}
