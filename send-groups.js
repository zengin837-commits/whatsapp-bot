const { client } = require('./yourClient'); // WhatsApp client nesnen
(async () => {
  try {
    const chats = await client.getAllChats();
    const groups = chats.filter(c => c.isGroup);

    for (let g of groups) {
      await client.sendMessage(g.id, { text: "Mesaj buraya" });
      console.log(`Mesaj gönderildi: ${g.name}`);
    }
  } catch (err) {
    console.error(err);
  }
})();