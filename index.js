const ethers = require('ethers');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');

const networks = {
    teaSepolia: {
        name: 'Tea Sepolia',
        chainId: 10218,
        rpc: 'https://tea-sepolia.g.alchemy.com/public',
        symbol: 'TEA',
        explorer: 'https://sepolia.tea.xyz'
    }
};

const WALLET_FILE = 'wallets.txt';
const FAUCET_API = 'https://faucet-sepolia.tea.xyz/';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

function randomDelay(min, max) {
    const delay = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
    return new Promise(resolve => setTimeout(resolve, delay));
}

function saveWalletToFile(address, privateKey) {
    const walletData = `${address}:${privateKey}\n`;
    fs.appendFileSync(WALLET_FILE, walletData);
}

function generateNewWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey
    };
}

async function claimFaucet(address) {
    try {
        const response = await axios.post(FAUCET_API, {
            address: address
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            }
        });

        if (response.data.success) {
            return {
                success: true,
                hash: response.data.data.hash,
                amount: response.data.data.amount
            };
        }
        return { success: false, error: 'Yêu cầu faucet thất bại' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function handleFaucetClaims() {
    try {
        const numWallets = parseInt(await askQuestion('Bạn muốn tạo bao nhiêu ví để nhận faucet? '));
        
        if (isNaN(numWallets) || numWallets <= 0) {
            console.error('Số lượng ví phải là một số dương!');
            return;
        }

        console.log('\nBắt đầu quá trình tạo ví và nhận faucet...');
        console.log(`Các ví sẽ được lưu vào: ${WALLET_FILE}\n`);

        for (let i = 0; i < numWallets; i++) {
            const wallet = generateNewWallet();
            console.log(`\nVí ${i + 1}/${numWallets}:`);
            console.log(`Địa chỉ: ${wallet.address}`);
            
            saveWalletToFile(wallet.address, wallet.privateKey);
            
            console.log('Đang cố gắng nhận faucet...');
            const result = await claimFaucet(wallet.address);
            
            if (result.success) {
                console.log(`Nhận thành công! Mã giao dịch: ${result.hash}`);
                console.log(`Số lượng: ${ethers.formatEther(result.amount)} ${networks.teaSepolia.symbol}`);
            } else {
                console.log(`Nhận thất bại: ${result.error}`);
            }

            if (i < numWallets - 1) {
                console.log('\nĐợi 5 giây trước khi tạo ví tiếp theo...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        console.log('\nQuá trình tạo ví và nhận faucet hoàn tất!');
        console.log(`Tổng số ví đã tạo: ${numWallets}`);
        console.log(`Ví đã được lưu vào: ${WALLET_FILE}`);

        const claimMainWallet = await askQuestion('\nBạn có muốn nhận faucet cho ví chính không? (có/không): ');
        if (claimMainWallet.toLowerCase() === 'có' || claimMainWallet.toLowerCase() === 'c') {
            const privateKey = fs.readFileSync('pk.txt', 'utf8').trim();
            const mainWallet = new ethers.Wallet(privateKey);
            console.log(`\nĐịa chỉ ví chính: ${mainWallet.address}`);
            console.log('Đang cố gắng nhận faucet cho ví chính...');
            const mainResult = await claimFaucet(mainWallet.address);
            
            if (mainResult.success) {
                console.log(`Nhận thành công cho ví chính! Mã giao dịch: ${mainResult.hash}`);
                console.log(`Số lượng: ${ethers.formatEther(mainResult.amount)} ${networks.teaSepolia.symbol}`);
            } else {
                console.log(`Nhận thất bại cho ví chính: ${mainResult.error}`);
            }
        } else {
            console.log('Đã bỏ qua việc nhận faucet cho ví chính.');
        }

        console.log('\nToàn bộ quá trình đã hoàn tất!');
    } catch (error) {
        console.error('Lỗi:', error.message);
    }
}

async function handleTokenTransfers(network) {
    try {
        const privateKey = fs.readFileSync('pk.txt', 'utf8').trim();
        const provider = new ethers.JsonRpcProvider(networks[network].rpc);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        console.log(`\nMạng đã chọn: ${networks[network].name}`);
        console.log(`Ký hiệu token: ${networks[network].symbol}`);
        
        const useRandom = await askQuestion('Bạn có muốn sử dụng số lượng ngẫu nhiên cho mỗi giao dịch không? (có/không): ');
        let amountPerTx, minAmount, maxAmount;
        
        if (useRandom.toLowerCase() === 'có' || useRandom.toLowerCase() === 'c') {
            minAmount = await askQuestion('Nhập số lượng token tối thiểu cho mỗi giao dịch: ');
            maxAmount = await askQuestion('Nhập số lượng token tối đa cho mỗi giao dịch: ');
            if (isNaN(minAmount) || isNaN(maxAmount) || parseFloat(minAmount) >= parseFloat(maxAmount)) {
                console.error('Số lượng không hợp lệ! Giá trị tối thiểu phải là số và nhỏ hơn giá trị tối đa.');
                return;
            }
        } else {
            amountPerTx = await askQuestion('Nhập số lượng token cho mỗi giao dịch: ');
            if (isNaN(amountPerTx)) {
                console.error('Số lượng phải là một số!');
                return;
            }
        }

        const numberOfTx = await askQuestion('Nhập số lượng giao dịch cần thực hiện: ');
        const minDelay = await askQuestion('Nhập thời gian chờ tối thiểu (giây) giữa các giao dịch: ');
        const maxDelay = await askQuestion('Nhập thời gian chờ tối đa (giây) giữa các giao dịch: ');
        
        if (isNaN(numberOfTx) || isNaN(minDelay) || isNaN(maxDelay)) {
            console.error('Tất cả giá trị nhập vào phải là số!');
            return;
        }

        for (let i = 0; i < numberOfTx; i++) {
            console.log(`\nĐang xử lý giao dịch ${i + 1} trong số ${numberOfTx}`);
            
            const newWallet = generateNewWallet();
            console.log(`Địa chỉ người nhận được tạo: ${newWallet.address}`);
            saveWalletToFile(newWallet.address, newWallet.privateKey);
            
            let currentAmount;
            if (useRandom.toLowerCase() === 'có' || useRandom.toLowerCase() === 'c') {
                currentAmount = (Math.random() * (parseFloat(maxAmount) - parseFloat(minAmount)) + parseFloat(minAmount)).toFixed(6);
                console.log(`Số lượng ngẫu nhiên được tạo: ${currentAmount} ${networks[network].symbol}`);
            } else {
                currentAmount = amountPerTx;
            }

            const tx = {
                to: newWallet.address,
                value: ethers.parseEther(currentAmount.toString())
            };

            const transaction = await wallet.sendTransaction(tx);
            console.log(`Giao dịch đã được gửi: ${transaction.hash}`);
            console.log(`Xem trên explorer: ${networks[network].explorer}/tx/${transaction.hash}`);
            
            await transaction.wait();
            
            if (i < numberOfTx - 1) {
                await randomDelay(parseInt(minDelay), parseInt(maxDelay));
            }
        }

        console.log('\nTất cả giao dịch đã hoàn tất thành công!');
    } catch (error) {
        console.error('Lỗi:', error.message);
    }
}

async function showMenu() {
    while (true) {
        console.log('\n=== BOT CRYPTO ĐA MẠNG | AIRDROP HIDDEN GEM ===');
        console.log('1. Tạo ví & Nhận faucet (Tea Sepolia)');
        console.log('2. Chuyển token TEA (Tea Sepolia)');
        console.log('3. Thoát');
        
        const choice = await askQuestion('\nChọn menu (1-3): ');
        
        switch (choice) {
            case '1':
                await handleFaucetClaims();
                break;
            case '2':
                await handleTokenTransfers('teaSepolia');
                break;
            case '3':
                console.log('Cảm ơn bạn đã sử dụng bot này!');
                rl.close();
                process.exit(0);
            default:
                console.log('Lựa chọn không hợp lệ!');
        }
    }
}

console.log('Đang khởi động Bot Đa Mạng...');
showMenu().catch(console.error);