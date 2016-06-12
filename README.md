
#### Usage

Switches:

 1. Manual/Auto 
 2. On/Off 
 3. Temp up/down 
 4. Mode switch 

Reset: `[Temp up]` + `[Mode switch]`  
Off: `[Temp down]` + `[Mode switch]` 


#### System & config

Local IP address: 192.168.1.254, ports 80, 22  
journalctl -p


#### Filesystems

fstrim -v /  


btrfs fi show /dev/sda2  
btrfs fi df /var  

btrfs scrub start /var  
btrfs scrub status /var  

btrfs balance start /var  
btrfs balance status /var  

btrfs fi defragment /var  





#### RPi kernel upgrade

There is a command line utility `rpi-update` that downloads and upgrades fresh kernel.

It expects the RPi directorys structure so it installs its file into `/boot` instead of into `/boot/firmware`

By default /boot should only contain standard Debian files:

```System.map-3.18.0-trunk-rpi2  firmware      initrd.img-3.18.0-trunk-rpi2  
config-3.18.0-trunk-rpi2      vmlinuz-3.18.0-trunk-rpi2```

Everything else littered into /boot should be copied into /boot/firmware instead

In addition `rpi-update` will move old kernel modules into `/lib/modules.bak` which can be removed.


#### i2c, 1-wire

`/etc/modules`:

 - i2c-dev  
 - i2c-bcm2708  
 - ds2482  

`i2cdetect -y 1`

 - ds2482 hub on 1c
 - i2c display on 27
 
initialize:  
echo ds2482 0x1c > /sys/bus/i2c/devices/i2c-1/new_device

ls /sys/bus/w1/devices
 