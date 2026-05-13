<?php
$plugin_path = "/plugins/undockerui";
$var = parse_ini_file("/var/local/emhttp/var.ini");
$csrf = $var['csrf_token'] ?? "";
?>
<style>
    /* Avoid negative margins (they break out of Dynamix content padding). */
    #undocker-wrapper {
        margin: 0;
        padding: 0;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        height: min(78vh, calc(100dvh - 200px));
        min-height: 420px;
    }
    #undocker-frame {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
    }
</style>
<div id="undocker-wrapper">
    <iframe id="undocker-frame" src="<?= $plugin_path ?>/dist/index.html?csrf=<?= $csrf ?>"></iframe>
</div>