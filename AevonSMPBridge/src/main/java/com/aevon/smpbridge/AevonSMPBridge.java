package com.aevon.smpbridge;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class AevonSMPBridge extends JavaPlugin {
    private HttpClient http;
    private BukkitTask task;
    private final Set<String> locallyProcessed = Collections.synchronizedSet(new HashSet<>());
    private final Queue<Ack> acknowledgements = new ConcurrentLinkedQueue<>();
    private final Set<String> inventoryNoticeSent = Collections.synchronizedSet(new HashSet<>());
    private File processedFile;
    private volatile boolean syncing = false;

    @Override public void onEnable() {
        saveDefaultConfig();
        processedFile = new File(getDataFolder(), "processed-orders.txt");
        loadProcessed();
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(Math.max(3, getConfig().getInt("request-timeout-seconds", 10)))).build();
        startTask();
        getLogger().info("AevonSMPBridge v" + getDescription().getVersion() + " enabled. Delivery check interval: " + getConfig().getInt("check-interval-seconds", 5) + " seconds.");
    }

    @Override public void onDisable() { if (task != null) task.cancel(); }

    private void startTask() {
        if (task != null) task.cancel();
        long ticks = Math.max(1, getConfig().getInt("check-interval-seconds", 5)) * 20L;
        task = Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::sync, 20L, ticks);
    }

    private void sync() {
        if (syncing) return;
        String secret = getConfig().getString("bridge-secret", "");
        String website = getConfig().getString("website-url", "").replaceAll("/+$", "");
        if (secret.isBlank() || secret.startsWith("CHANGE-ME") || website.isBlank()) return;
        syncing = true;
        try {
            List<PlayerSnapshot> players = new ArrayList<>();
            for (Player p : Bukkit.getOnlinePlayers()) players.add(new PlayerSnapshot(p.getName(), p.getUniqueId().toString()));
            List<Ack> sentAcks = new ArrayList<>(); Ack a; while ((a = acknowledgements.poll()) != null) sentAcks.add(a);
            String payload = buildPayload(players, sentAcks);
            HttpRequest req = HttpRequest.newBuilder(URI.create(website + "/api/aevonsmp/bridge/sync"))
                    .timeout(Duration.ofSeconds(Math.max(3, getConfig().getInt("request-timeout-seconds", 10))))
                    .header("Content-Type", "application/json").header("X-AevonSMP-Secret", secret)
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8)).build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() / 100 != 2) { sentAcks.forEach(acknowledgements::offer); getLogger().warning("Bridge sync returned HTTP " + res.statusCode()); return; }
            List<Order> orders = parseOrders(res.body());
            if (!orders.isEmpty()) Bukkit.getScheduler().runTask(this, () -> orders.forEach(this::deliver));
        } catch (Exception ex) {
            getLogger().warning("Bridge sync failed: " + ex.getMessage());
        } finally { syncing = false; }
    }

    private void deliver(Order o) {
        Player player = Bukkit.getPlayerExact(o.minecraftIgn);
        if (player == null) for (Player candidate : Bukkit.getOnlinePlayers()) if (candidate.getName().equalsIgnoreCase(o.minecraftIgn)) { player = candidate; break; }
        if (player == null) { acknowledgements.offer(new Ack(o.id, "waiting_player", "Player is offline.")); return; }
        if (locallyProcessed.contains(o.id)) { acknowledgements.offer(new Ack(o.id, "delivered", "Already processed locally; acknowledgement replayed.")); return; }
        int free = countFreeSlots(player);
        if (o.requiredFreeSlots > 0 && free < o.requiredFreeSlots) {
            String msg = color(getConfig().getString("messages.waiting-inventory", "&ePlease free inventory space.")).replace("{product}", o.productName).replace("{slots}", String.valueOf(o.requiredFreeSlots));
            if (inventoryNoticeSent.add(o.id)) player.sendMessage(msg);
            acknowledgements.offer(new Ack(o.id, "waiting_inventory", "Needs " + o.requiredFreeSlots + " free slot(s); currently " + free + "."));
            return;
        }
        try {
            int executions = "per_quantity".equalsIgnoreCase(o.commandMode) ? Math.max(1, o.quantity) : 1;
            for (int i = 0; i < executions; i++) {
                String command = o.rewardCommand
                        .replace("{player}", player.getName())
                        .replace("{quantity}", String.valueOf(o.quantity))
                        .replace("{order_id}", o.orderCode)
                        .replace("{product}", o.productName);
                boolean ok = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command);
                if (!ok) throw new IllegalStateException("Command returned false: " + command);
            }
            markProcessed(o.id);
            inventoryNoticeSent.remove(o.id);
            String delivered = color(getConfig().getString("messages.reward-delivered", "&aReward delivered!")).replace("{product}", o.productName);
            player.sendMessage(delivered);
            acknowledgements.offer(new Ack(o.id, "delivered", "Reward command completed."));
            getLogger().info("Delivered order " + o.orderCode + " to " + player.getName() + ".");
        } catch (Exception ex) {
            acknowledgements.offer(new Ack(o.id, "failed", ex.getMessage()));
            getLogger().severe("Could not deliver order " + o.orderCode + ": " + ex.getMessage());
        }
    }

    private int countFreeSlots(Player p) {
        int free = 0;
        for (ItemStack item : p.getInventory().getStorageContents()) if (item == null || item.getType().isAir()) free++;
        return free;
    }

    private synchronized void markProcessed(String id) throws IOException {
        if (!locallyProcessed.add(id)) return;
        if (!getDataFolder().exists()) getDataFolder().mkdirs();
        Files.writeString(processedFile.toPath(), id + System.lineSeparator(), StandardCharsets.UTF_8,
                java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND);
    }
    private void loadProcessed() {
        try { if (processedFile.exists()) locallyProcessed.addAll(Files.readAllLines(processedFile.toPath(), StandardCharsets.UTF_8)); }
        catch (IOException e) { getLogger().warning("Could not load processed order cache: " + e.getMessage()); }
    }

    @Override public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("aevonsmpbridge.admin")) { sender.sendMessage(color("&cYou do not have permission.")); return true; }
        if (args.length > 0 && args[0].equalsIgnoreCase("reload")) { reloadConfig(); startTask(); sender.sendMessage(color("&aAevonSMPBridge configuration reloaded.")); return true; }
        sender.sendMessage(color("&bAevonSMPBridge &fv" + getDescription().getVersion()));
        sender.sendMessage(color("&7Website: &f" + getConfig().getString("website-url")));
        sender.sendMessage(color("&7Interval: &f" + getConfig().getInt("check-interval-seconds", 5) + "s"));
        sender.sendMessage(color("&7Processed locally: &f" + locallyProcessed.size()));
        return true;
    }

    private String buildPayload(List<PlayerSnapshot> players, List<Ack> acks) {
        StringBuilder s = new StringBuilder("{");
        field(s,"serverId",getConfig().getString("server-id","aevonsmp-main"));s.append(',');field(s,"serverName",getConfig().getString("server-name","AevonSMP"));s.append(',');field(s,"serverAddress",getConfig().getString("server-address","aevonsmp.online"));s.append(',');
        s.append("\"playersMax\":").append(Bukkit.getMaxPlayers()).append(',');field(s,"minecraftVersion",Bukkit.getMinecraftVersion());s.append(',');field(s,"pluginVersion",getDescription().getVersion());s.append(",\"players\":[");
        for(int i=0;i<players.size();i++){if(i>0)s.append(',');s.append('{');field(s,"name",players.get(i).name);s.append(',');field(s,"uuid",players.get(i).uuid);s.append('}');}s.append("],\"acknowledgements\":[");
        for(int i=0;i<acks.size();i++){if(i>0)s.append(',');Ack a=acks.get(i);s.append('{');field(s,"orderId",a.orderId);s.append(',');field(s,"status",a.status);s.append(',');field(s,"message",a.message);s.append('}');}return s.append("]}").toString();
    }
    private static void field(StringBuilder s,String k,String v){s.append('"').append(esc(k)).append("\":\"").append(esc(v==null?"":v)).append('"');}
    private static String esc(String v){return v.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r");}

    private List<Order> parseOrders(String json) {
        List<Order> out = new ArrayList<>();
        Matcher array = Pattern.compile("\\\"orders\\\"\\s*:\\s*\\[(.*)]", Pattern.DOTALL).matcher(json); if(!array.find()) return out;
        String content=array.group(1);
        for (String x : splitObjects(content)) {
            String id=str(x,"id"),code=str(x,"order_code"),product=str(x,"product_name"),ign=str(x,"minecraft_ign"),cmd=str(x,"reward_command"),mode=str(x,"command_mode");
            if(id==null||ign==null||cmd==null)continue;out.add(new Order(id,code==null?id:code,product==null?"Reward":product,ign,integer(x,"quantity",1),cmd,mode==null?"once":mode,integer(x,"required_free_slots",0)));
        } return out;
    }

    private static List<String> splitObjects(String content) {
        List<String> objects = new ArrayList<>(); int depth=0,start=-1; boolean quoted=false,escaped=false;
        for(int i=0;i<content.length();i++){char c=content.charAt(i);if(quoted){if(escaped)escaped=false;else if(c=='\\')escaped=true;else if(c=='"')quoted=false;continue;}if(c=='"'){quoted=true;continue;}if(c=='{'){if(depth++==0)start=i+1;}else if(c=='}'&&depth>0&&--depth==0&&start>=0){objects.add(content.substring(start,i));start=-1;}}
        return objects;
    }
    private static String str(String obj,String key){Matcher m=Pattern.compile("\\\""+Pattern.quote(key)+"\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"])*)\\\"").matcher(obj);return m.find()?unesc(m.group(1)):null;}
    private static int integer(String obj,String key,int def){Matcher m=Pattern.compile("\\\""+Pattern.quote(key)+"\\\"\\s*:\\s*(-?\\d+)").matcher(obj);return m.find()?Integer.parseInt(m.group(1)):def;}
    private static String unesc(String s){return s.replace("\\\"","\"").replace("\\n","\n").replace("\\r","\r").replace("\\\\","\\");}
    private static String color(String s){return ChatColor.translateAlternateColorCodes('&',s==null?"":s);}

    private record PlayerSnapshot(String name,String uuid){}
    private record Ack(String orderId,String status,String message){}
    private record Order(String id,String orderCode,String productName,String minecraftIgn,int quantity,String rewardCommand,String commandMode,int requiredFreeSlots){}
}
