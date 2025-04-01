import { ethers } from 'ethers';   // Thay thế require('ethers')
import fs from 'fs';                // Thay thế require('fs')
import readline from 'readline';    // Thay thế require('readline')
import chalk from 'chalk';  // Sử dụng import thay vì require

const networks = {
    teaSepolia: {
        name: 'Tea Sepolia',
        chainId: 10218,
        rpc: 'https://tea-sepolia.g.alchemy.com/public',
        symbol: 'TEA',
        explorer: 'https://sepolia.tea.xyz',
        decimals: 18
    }
};

const WALLET_FILE_1 = 'wallets1.txt';
const WALLET_FILE_2 = 'wallets2.txt';
const PK1_FILE = 'pk1.txt'; // File chứa khóa riêng ví chính 1
const PK2_FILE = 'pk2.txt'; // File chứa khóa riêng ví chính 2

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(chalk.cyan(query), resolve));  // Thêm màu cho câu hỏi

function randomDelay(min, max) {
    const delay = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
    return new Promise(resolve => setTimeout(resolve, delay));
}

function saveWalletToFile(address, privateKey, group) {
    const walletData = `${address}:${privateKey}:${group}\n`;
    if (group === 'wallets1') {
        fs.appendFileSync(WALLET_FILE_1, walletData); // Lưu vào wallets1.txt
    } else if (group === 'wallets2') {
        fs.appendFileSync(WALLET_FILE_2, walletData); // Lưu vào wallets2.txt
    }
}

function generateNewWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey
    };
}

async function handleCreateWallets() {
    try {
        const numWallets = parseInt(await askQuestion(chalk.yellow('Bạn muốn tạo bao nhiêu ví? 🧑‍💻 ')));
        
        if (isNaN(numWallets) || numWallets <= 0) {
            console.error(chalk.red('❌ Số lượng ví phải là một số dương!'));
            return;
        }

        const numWalletsPerGroup = Math.floor(numWallets / 2);
        console.log(chalk.green(`✅ Tạo ${numWalletsPerGroup} ví cho wallets1 và ${numWalletsPerGroup} ví cho wallets2`));

        console.log(chalk.blue('\n🔨 Bắt đầu quá trình tạo ví...'));
        console.log(chalk.green(`💾 Các ví sẽ được lưu vào: wallets1.txt và wallets2.txt\n`));

        // Xóa toàn bộ nội dung của các file wallets1.txt và wallets2.txt trước khi tạo ví mới
        fs.writeFileSync(WALLET_FILE_1, ''); 
        fs.writeFileSync(WALLET_FILE_2, ''); 

        // Thông báo xóa thành công
        console.log(chalk.green('✅ Đã xóa nội dung của wallets1.txt và wallets2.txt thành công!'));

        for (let i = 0; i < numWalletsPerGroup; i++) {
            const wallet = generateNewWallet();
            console.log(chalk.cyan(`💳 Ví ${i + 1}/${numWalletsPerGroup} (wallets1):`));
            console.log(chalk.green(`🗝 Địa chỉ: ${wallet.address}`));
            
            saveWalletToFile(wallet.address, wallet.privateKey, 'wallets1');  // Lưu vào wallets1.txt
            await randomDelay(1, 3);
        }

        for (let i = 0; i < numWalletsPerGroup; i++) {
            const wallet = generateNewWallet();
            console.log(chalk.cyan(`💳 Ví ${i + 1}/${numWalletsPerGroup} (wallets2):`));
            console.log(chalk.green(`🗝 Địa chỉ: ${wallet.address}`));
            
            saveWalletToFile(wallet.address, wallet.privateKey, 'wallets2');  // Lưu vào wallets2.txt
            await randomDelay(1, 3);
        }

        console.log(chalk.green('\n✅ Quá trình tạo ví hoàn tất!'));
    } catch (error) {
        console.error(chalk.red('❌ Lỗi:'), error.message);
    }
}

// Định nghĩa hàm sendToken
async function sendToken(privateKey, walletsFile, amountPerTx, provider, useRandom, minAmount, maxAmount) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletsData = fs.readFileSync(walletsFile, 'utf-8').split('\n').filter(line => line);
    let walletCount = 1;

    for (const walletData of walletsData) {
        const [address] = walletData.split(':');
        let amount;
        
        // Nếu sử dụng số lượng ngẫu nhiên, tính toán số lượng token
        if (useRandom) {
            amount = (Math.random() * (maxAmount - minAmount) + minAmount).toFixed(6);
        } else {
            amount = amountPerTx;
        }

        // Chuyển số lượng token thành đơn vị nhỏ nhất (wei)
        const tokenAmount = ethers.parseUnits(amount.toString(), 18); // Assuming the token has 18 decimals

        const tx = {
            to: address,
            value: tokenAmount
        };

        console.log(chalk.blue(`💰 Gửi ${amount} token đến ${address} - Ví thứ: ${walletCount}`));

        try {
            const transaction = await wallet.sendTransaction(tx);
            console.log(chalk.green(`✅ Giao dịch đã được gửi: ${transaction.hash}`));
            console.log(chalk.yellow(`🌐 Xem trên explorer: ${networks.teaSepolia.explorer}/tx/${transaction.hash}`));
            await transaction.wait();
        } catch (error) {
            console.error(chalk.red(`❌ Lỗi khi gửi đến ${address}: ${error.message}`));
        }
        walletCount++;
    }
}

async function handleSendToken() {
    try {
        const useRandom = await askQuestion(chalk.yellow('Bạn có muốn sử dụng số lượng ngẫu nhiên cho mỗi giao dịch không? (có/không): 🎲 '));

        let amountPerTx, minAmount, maxAmount;
        
        if (useRandom.toLowerCase() === 'có' || useRandom.toLowerCase() === 'c') {
            minAmount = await askQuestion(chalk.yellow('Nhập số lượng token tối thiểu cho mỗi giao dịch: 📉 '));
            maxAmount = await askQuestion(chalk.yellow('Nhập số lượng token tối đa cho mỗi giao dịch: 📈 '));

            if (isNaN(minAmount) || isNaN(maxAmount) || parseFloat(minAmount) >= parseFloat(maxAmount)) {
                console.error(chalk.red('❌ Số lượng không hợp lệ! Giá trị tối thiểu phải là số và nhỏ hơn giá trị tối đa.'));
                return;
            }
        } else {
            amountPerTx = await askQuestion(chalk.yellow('Nhập số lượng token cho mỗi giao dịch: 💸 '));
            if (isNaN(amountPerTx)) {
                console.error(chalk.red('❌ Số lượng phải là một số!'));
                return;
            }
        }

        const numberOfTx = await askQuestion(chalk.yellow('Nhập số lượng giao dịch cần thực hiện: 🔢 '));
        const minDelay = await askQuestion(chalk.yellow('Nhập thời gian chờ tối thiểu (giây) giữa các giao dịch: ⏳ '));
        const maxDelay = await askQuestion(chalk.yellow('Nhập thời gian chờ tối đa (giây) giữa các giao dịch: ⏳ '));

        const pk1 = fs.readFileSync(PK1_FILE, 'utf-8').trim();
        const pk2 = fs.readFileSync(PK2_FILE, 'utf-8').trim();

        if (!pk1 || !pk2) {
            console.error(chalk.red('❌ Không tìm thấy khóa riêng trong các file pk1.txt hoặc pk2.txt'));
            return;
        }

        console.log(chalk.green('✅ Đang thực hiện gửi token...'));

        const provider = new ethers.JsonRpcProvider(networks.teaSepolia.rpc);

        console.log(chalk.blue('\n🔁 Gửi từ ví chính 1 (pk1.txt) đến wallets1.txt...'));
        for (let i = 0; i < numberOfTx; i++) {
            await sendToken(pk1, WALLET_FILE_1, amountPerTx, provider, useRandom.toLowerCase() === 'có' || useRandom.toLowerCase() === 'c', parseFloat(minAmount), parseFloat(maxAmount));
            await randomDelay(parseInt(minDelay), parseInt(maxDelay));
        }

        console.log(chalk.blue('\n🔁 Gửi từ ví chính 2 (pk2.txt) đến wallets2.txt...'));
        for (let i = 0; i < numberOfTx; i++) {
            await sendToken(pk2, WALLET_FILE_2, amountPerTx, provider, useRandom.toLowerCase() === 'có' || useRandom.toLowerCase() === 'c', parseFloat(minAmount), parseFloat(maxAmount));
            await randomDelay(parseInt(minDelay), parseInt(maxDelay));
        }

        console.log(chalk.green('\n✅ Quá trình gửi token hoàn tất!'));
    } catch (error) {
        console.error(chalk.red('❌ Lỗi:'), error.message);
    }
}

async function showMenu() {
    while (true) {
        console.log(chalk.yellow('\n=== BOT Của Đớ Thủ ==='));
        console.log(chalk.cyan('1. Tạo ví mới 🆕'));
        console.log(chalk.cyan('2. Gửi token từ ví chính đến ví phụ 💸'));
        console.log(chalk.cyan('3. Thoát ❌'));
        
        const choice = await askQuestion(chalk.cyan('\nChọn menu (1-3): 🧑‍💻 '));

        switch (choice) {
            case '1':
                await handleCreateWallets();
                break;
            case '2':
                await handleSendToken();
                break;
            case '3':
                console.log(chalk.green('✅ Cảm ơn bạn đã sử dụng bot này!'));
                rl.close();
                process.exit(0);
            default:
                console.log(chalk.red('❌ Lựa chọn không hợp lệ!'));
        }
    }
}

console.log(chalk.green('🚀 Đang khởi động Bot Đa Mạng...'));
showMenu().catch(console.error);
