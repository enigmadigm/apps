import { Command } from "src/gm";

export const command: Command = {
    name: 'ping',
    description: {
        short: 'the classic',
        long: "Get client latency data. Just to get to this command, at least ten (10) calls to the database were made (not all asynchronous), so that db latency stacks up.",
    },
    cooldown: 0,
    async execute(client, message) {
        try {
            // Calculates ping between sending a message and editing it, giving a nice round-trip latency.
            // The second ping is an average latency between the bot and the websocket server (one-way, not round-trip)
            const m = await message.channel.send("Ping?");
            const dbRoundTrip = await client.database.getPing();
            const nanoDatabaseLatency = (dbRoundTrip[1] / 1e+6).toFixed(1);
            m.edit(`Pong! Latency is ${m.createdTimestamp - message.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms. Database latency is ${nanoDatabaseLatency}ms.`);
        } catch (error) {
            xlg.error(error);
            await client.specials.sendError(message.channel);
            return false;
        }
    }
}
