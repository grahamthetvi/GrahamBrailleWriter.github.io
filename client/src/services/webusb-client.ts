/**
 * WebUSB Client — communicates directly with connected braille embossers
 * via the browser's WebUSB API (`navigator.usb`).
 * 
 * Specifically designed for ChromeOS where local Go binaries cannot run.
 */

// Basic declarations for WebUSB so the compiler does not complain.
declare global {
    interface Navigator {
        usb: any;
    }
}

export async function printBrfWebUSB(data: Uint8Array): Promise<void> {
    if (!('usb' in navigator)) {
        throw new Error('WebUSB is not supported in this browser.');
    }

    let device: any;
    try {
        // Prompt user to select a USB device (empty filters allow any device)
        device = await navigator.usb.requestDevice({ filters: [] });
    } catch (err) {
        throw new Error('No device selected or permission denied.');
    }

    try {
        await device.open();

        // Select the default configuration if one isn't already selected
        if (device.configuration === null && device.configurations.length > 0) {
            await device.selectConfiguration(device.configurations[0].configurationValue);
        }

        if (!device.configuration) {
            throw new Error('Failed to select a USB configuration on the device.');
        }

        // Find the bulk transfer OUT endpoint
        let interfaceNumber = -1;
        let endpointNumber = -1;

        for (const intf of device.configuration.interfaces) {
            for (const alt of intf.alternates) {
                for (const ep of alt.endpoints) {
                    if (ep.direction === 'out' && ep.type === 'bulk') {
                        interfaceNumber = intf.interfaceNumber;
                        endpointNumber = ep.endpointNumber;
                        break;
                    }
                }
                if (endpointNumber !== -1) break;
            }
            if (endpointNumber !== -1) break;
        }

        if (interfaceNumber === -1 || endpointNumber === -1) {
            throw new Error('No bulk output endpoint found on this device.');
        }

        // Claim the interface to take control
        await device.claimInterface(interfaceNumber);

        try {
            // Send binary data directly to the embosser
            const result = await device.transferOut(endpointNumber, data);
            if (result.status !== 'ok') {
                throw new Error(`USB transfer failed with status: ${result.status}`);
            }
        } finally {
            // Always release interface
            await device.releaseInterface(interfaceNumber);
        }
    } finally {
        // Always close the device
        await device.close();
    }
}
