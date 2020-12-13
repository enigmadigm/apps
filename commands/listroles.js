const xlg = require("../xlogger");
const { permLevels } = require('../permissions');
const { getGlobalSetting } = require("../dbmanager");

module.exports = {
    name: 'listroles',
    aliases: ['lsroles'],
    description: 'list all of the roles in the server',
    guildOnly: true,
    category: 'utility',
    permLevel: permLevels.trustedMember,
    async execute(client, message) {
        try {
            const roleArray = message.guild.roles.cache.sort((roleA, roleB) => roleB.position - roleA.position).filter((x) => x.name !== "@everyone").array().map(r => `${message.guild.roles.cache.get(r.id)}`);
            if (roleArray.join("\n").length > 1024) {
                while (roleArray.join("\n").length > 1010) {
                    roleArray.pop();
                }
                roleArray.push("***...some not shown***")
            }

            message.channel.send({
                embed: {
                    color: parseInt((await getGlobalSetting("info_embed_color"))[0].value, 10),//7322774
                    author: {
                        name: `${message.guild.name} Roles`,
                        icon_url: message.guild.iconURL()
                    },
                    description: `${roleArray.join("\n") || '*none*'}`,
                    footer: {
                        text: `Roles: ${message.guild.roles.cache.array().length}`
                    }
                }
            }).catch(xlg.error);
        } catch (error) {
            xlg.error(error);
            await client.specials.sendError(message.channel);
            return false;
        }
    }
}