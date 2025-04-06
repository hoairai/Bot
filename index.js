import fs from 'fs';
import { ethers, JsonRpcProvider } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import solc from 'solc';
import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

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

// File constants
const WALLET_FILE_1 = 'wallets1.txt';
const WALLET_FILE_2 = 'wallets2.txt';
const PK1_FILE = 'pk1.txt';
const PK2_FILE = 'pk2.txt';
const PROXY_FILE = 'proxy.txt';

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Utility functions
const askQuestion = (query) => new Promise(resolve => rl.question(chalk.cyan(query), resolve));

const randomDelay = (min, max) => {
    const delay = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
    return new Promise(resolve => setTimeout(resolve, delay));
};

// Provider creation with proxy
const createProviderWithProxy = (proxyUrl) => {
    const agent = new HttpsProxyAgent(proxyUrl);
    return new JsonRpcProvider(networks.teaSepolia.rpc, undefined, { httpAgent: agent });
};

// Wallet functions
const checkBalance = async (privateKey, proxyUrl) => {
    try {
        const provider = proxyUrl ? createProviderWithProxy(proxyUrl) : new JsonRpcProvider(networks.teaSepolia.rpc);
        const wallet = new ethers.Wallet(privateKey, provider);
        const balance = await provider.getBalance(wallet.address);
        return {
            address: wallet.address,
            balance: ethers.formatEther(balance),
            provider
        };
    } catch (error) {
        throw new Error(`Lỗi khi kiểm tra số dư: ${error.message}`);
    }
};

const saveWalletToFile = (address, privateKey, group) => {
    const walletData = `${address}:${privateKey}:${group}\n`;
    fs.appendFileSync(group === 'wallets1' ? WALLET_FILE_1 : WALLET_FILE_2, walletData);
};

const generateNewWallet = () => {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey
    };
};

// Wallet creation handler
async function handleCreateWallets() {
    try {
        const numWallets = parseInt(await askQuestion(chalk.yellow('Bạn muốn tạo bao nhiêu ví? ')));
        if (isNaN(numWallets) || numWallets <= 0) {
            console.error(chalk.red('⚠ Số lượng ví phải là một số dương!'));
            return;
        }

        const numWalletsPerGroup = Math.floor(numWallets / 2);
        console.log(chalk.green(`✔ Tạo ${numWalletsPerGroup} ví cho wallets1 và ${numWalletsPerGroup} ví cho wallets2`));

        fs.writeFileSync(WALLET_FILE_1, '');
        fs.writeFileSync(WALLET_FILE_2, '');
        console.log(chalk.green('✔ Đã xóa nội dung của wallets1.txt và wallets2.txt thành công!'));

        for (let i = 0; i < numWalletsPerGroup; i++) {
            const wallet = generateNewWallet();
            console.log(chalk.cyan(`✨ Ví ${i + 1}/${numWalletsPerGroup} (wallets1):`));
            console.log(chalk.green(`Địa chỉ: ${wallet.address}`));
            saveWalletToFile(wallet.address, wallet.privateKey, 'wallets1');
            await randomDelay(1, 3);
        }

        for (let i = 0; i < numWalletsPerGroup; i++) {
            const wallet = generateNewWallet();
            console.log(chalk.cyan(`✨ Ví ${i + 1}/${numWalletsPerGroup} (wallets2):`));
            console.log(chalk.green(`Địa chỉ: ${wallet.address}`));
            saveWalletToFile(wallet.address, wallet.privateKey, 'wallets2');
            await randomDelay(1, 3);
        }

        console.log(chalk.green('\n✔ Quá trình tạo ví hoàn tất!'));
    } catch (error) {
        console.error(chalk.red('❌ Lỗi:'), error.message);
    }
}

// Token sending functions
const getRandomAmount = (min, max) => {
    const random = Math.random() * (max - min) + min;
    return random.toFixed(6); // Trả về chuỗi số với 6 chữ số thập phân
};

async function sendToken(privateKey, walletsFile, amountPerTx, provider, useRandom, minAmount, maxAmount, numberOfTx, proxyUrl) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletsData = fs.readFileSync(walletsFile, 'utf-8').split('\n').filter(line => line);

    if (numberOfTx > walletsData.length) {
        console.log(chalk.red(`❌ Số lượng giao dịch (${numberOfTx}) vượt quá số ví có sẵn (${walletsData.length})!`));
        return;
    }

    // Tạo mảng chỉ số ngẫu nhiên không trùng lặp
    const usedIndices = new Set();
    const getRandomIndex = () => {
        let index;
        do {
            index = Math.floor(Math.random() * walletsData.length);
        } while (usedIndices.has(index) && usedIndices.size < walletsData.length);
        usedIndices.add(index);
        return index;
    };

    let walletCount = 1;

    for (let i = 0; i < numberOfTx; i++) {
        const randomIndex = getRandomIndex();
        const [address] = walletsData[randomIndex].split(':');
        let amount;

        if (useRandom) {
            amount = getRandomAmount(minAmount, maxAmount); // Lấy số ngẫu nhiên dạng chuỗi
        } else {
            amount = amountPerTx.toString(); // Chuyển amountPerTx thành chuỗi
        }

        const tokenAmount = ethers.parseUnits(amount, 18); // Chuyển sang wei

        const tx = {
            to: address,
            value: tokenAmount
        };

        console.log(chalk.blue(`✨ Gửi ${amount} token đến ${address} - Ví thứ: ${walletCount}${proxyUrl ? ` qua proxy ${proxyUrl}` : ''}`));
        try {
            const transaction = await wallet.sendTransaction(tx);
            console.log(chalk.green(`✔ Giao dịch đã được gửi: ${transaction.hash}`));
            console.log(chalk.yellow(`🔍 Xem trên explorer: ${networks.teaSepolia.explorer}/tx/${transaction.hash}`));
            await transaction.wait();
            await randomDelay(10, 15); // Thêm delay giữa các giao dịch
        } catch (error) {
            console.error(chalk.red(`❌ Lỗi khi gửi đến ${address}: ${error.message}`));
        }
        walletCount++;
    }
}

async function handleSendToken() {
    try {
        const useRandom = await askQuestion(chalk.yellow('Bạn có muốn sử dụng số lượng ngẫu nhiên cho mỗi giao dịch không? (có/không): '));
        let amountPerTx, minAmount, maxAmount;

        if (useRandom.toLowerCase() === 'có' || useRandom.toLowerCase() === 'c') {
            minAmount = parseFloat(await askQuestion(chalk.yellow('Nhập số lượng token tối thiểu cho mỗi giao dịch: ')));
            maxAmount = parseFloat(await askQuestion(chalk.yellow('Nhập số lượng token tối đa cho mỗi giao dịch: ')));
            if (isNaN(minAmount) || isNaN(maxAmount) || minAmount >= maxAmount) {
                console.error(chalk.red('❌ Số lượng không hợp lệ! Giá trị tối thiểu phải nhỏ hơn tối đa.'));
                return;
            }
        } else {
            amountPerTx = parseFloat(await askQuestion(chalk.yellow('Nhập số lượng token cho mỗi giao dịch: ')));
            if (isNaN(amountPerTx)) {
                console.error(chalk.red('❌ Số lượng phải là một số!'));
                return;
            }
        }

        const numberOfTx = parseInt(await askQuestion(chalk.yellow('Nhập số lượng giao dịch cần thực hiện: ')));
        const minDelay = parseInt(await askQuestion(chalk.yellow('Nhập thời gian chờ tối thiểu (giây) giữa các giao dịch: ')));
        const maxDelay = parseInt(await askQuestion(chalk.yellow('Nhập thời gian chờ tối đa (giây) giữa các giao dịch: ')));

        const pkChoice = await askQuestion(chalk.yellow('Chọn ví (1 - pk1.txt / 2 - pk2.txt): '));
        let pk, walletsFile, proxyUrl;

        if (pkChoice === '1') {
            pk = fs.readFileSync(PK1_FILE, 'utf-8').trim();
            walletsFile = WALLET_FILE_1;
        } else if (pkChoice === '2') {
            pk = fs.readFileSync(PK2_FILE, 'utf-8').trim();
            walletsFile = WALLET_FILE_2;
        } else {
            console.error(chalk.red('❌ Lỗi: Vui lòng chọn ví hợp lệ (1 hoặc 2)!'));
            return;
        }

        if (!pk) {
            console.error(chalk.red('❌ Không tìm thấy khóa riêng trong file ví đã chọn!'));
            return;
        }

        const useProxy = await askQuestion(chalk.yellow('Có sử dụng proxy không? (có/không): '));
        let provider;

        if (useProxy.toLowerCase() === 'có' || useProxy.toLowerCase() === 'c') {
            let proxies;
            try {
                proxies = fs.readFileSync(PROXY_FILE, 'utf-8')
                          .split('\n')
                          .filter(line => line.trim() !== '');
                if (proxies.length < 2) {
                    console.error(chalk.red('❌ File proxy.txt phải chứa ít nhất 2 proxy!'));
                    return;
                }
            } catch (error) {
                console.error(chalk.red('❌ Lỗi khi đọc file proxy.txt:'), error.message);
                return;
            }

            proxyUrl = pkChoice === '1' ? proxies[0] : proxies[1];
            console.log(chalk.yellow(`Sử dụng proxy: ${proxyUrl} cho ví ${pkChoice === '1' ? 'pk1' : 'pk2'}`));
            provider = createProviderWithProxy(proxyUrl);
        } else {
            provider = new JsonRpcProvider(networks.teaSepolia.rpc);
        }

        await sendToken(
            pk,
            walletsFile,
            amountPerTx,
            provider,
            useRandom.toLowerCase() === 'có' || useRandom.toLowerCase() === 'c',
            minAmount || 0,
            maxAmount || 0,
            numberOfTx,
            proxyUrl // Truyền proxyUrl vào sendToken để hiển thị trong log
        );
        console.log(chalk.green('✔ Gửi token thành công cho tất cả các giao dịch!'));
    } catch (error) {
        console.error(chalk.red('❌ Lỗi:'), error.message);
    }
}

// Contract deployment
async function deployContract(privateKey, proxyUrl) {
    try {
        const provider = proxyUrl ? createProviderWithProxy(proxyUrl) : new JsonRpcProvider(networks.teaSepolia.rpc);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        const contractSource = fs.readFileSync('auto.sol', 'utf8');
        const input = {
            language: 'Solidity',
            sources: {
                'auto.sol': { content: contractSource }
            },
            settings: {
                outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
            }
        };

        const output = JSON.parse(solc.compile(JSON.stringify(input)));
        const contractName = Object.keys(output.contracts['auto.sol'])[0];
        const contractData = output.contracts['auto.sol'][contractName];

        if (!contractData.evm.bytecode.object) {
            console.log(chalk.red('❌ Biên dịch smart contract thất bại! Vui lòng kiểm tra code Solidity.'));
            return;
        }

        const contractFactory = new ethers.ContractFactory(contractData.abi, contractData.evm.bytecode.object, wallet);
        console.log(chalk.yellow(`⚡ Đang deploy smart contract${proxyUrl ? ` qua proxy ${proxyUrl}` : ''}...`));
        const contract = await contractFactory.deploy('MyToken', 'MTK', 1000000, wallet.address);
        await contract.waitForDeployment();

        const contractAddress = await contract.getAddress();
        console.log(chalk.green(`✅ Smart contract đã được deploy! Địa chỉ: ${chalk.blue(contractAddress)}`));
        console.log(chalk.cyan(`🔍 Xem smart contract: ${networks.teaSepolia.explorer}/address/${contractAddress}`));
    } catch (error) {
        console.error(chalk.red(`❌ Deploy smart contract thất bại: ${error.message}`));
    }
}

async function handleDeployContract() {
    try {
        const pkChoice = await askQuestion(chalk.yellow('Chọn ví (1 - pk1.txt / 2 - pk2.txt): '));
        let pk = pkChoice === '1' ? fs.readFileSync(PK1_FILE, 'utf-8').trim() : 
                 pkChoice === '2' ? fs.readFileSync(PK2_FILE, 'utf-8').trim() : null;

        if (!pk) {
            console.error(chalk.red('❌ Lỗi: Vui lòng chọn ví hợp lệ hoặc khóa riêng không tồn tại!'));
            return;
        }

        const useProxy = await askQuestion(chalk.yellow('Có sử dụng proxy không? (có/không): '));
        if (useProxy.toLowerCase() === 'có' || useProxy.toLowerCase() === 'c') {
            let proxies;
            try {
                proxies = fs.readFileSync(PROXY_FILE, 'utf-8')
                          .split('\n')
                          .filter(line => line.trim() !== '');
                if (proxies.length < 2) {
                    console.error(chalk.red('❌ File proxy.txt phải chứa ít nhất 2 proxy!'));
                    return;
                }
            } catch (error) {
                console.error(chalk.red('❌ Lỗi khi đọc file proxy.txt:'), error.message);
                return;
            }

            const proxyUrl = pkChoice === '1' ? proxies[0] : proxies[1];
            console.log(chalk.yellow(`Sử dụng proxy: ${proxyUrl} cho ví ${pkChoice === '1' ? 'pk1' : 'pk2'}`));
            await deployContract(pk, proxyUrl);
        } else {
            await deployContract(pk);
        }
    } catch (error) {
        console.error(chalk.red('❌ Lỗi khi deploy smart contract:'), error.message);
    }
}

// Main menu
async function showMenu() {
    while (true) {
        console.log(chalk.yellow('\n=== BOT Đớ THủ ==='));
        console.log(chalk.cyan('1. Tạo ví mới'));
        console.log(chalk.cyan('2. Gửi token từ ví chính đến ví phụ (ngẫu nhiên)'));
        console.log(chalk.cyan('3. Deploy Smart Contract'));
        console.log(chalk.cyan('4. Thoát'));

        const choice = await askQuestion(chalk.cyan('\nChọn menu (1-4): '));

        switch (choice) {
            case '1': await handleCreateWallets(); break;
            case '2': await handleSendToken(); break;
            case '3': await handleDeployContract(); break;
            case '4':
                console.log(chalk.green('👋 Cảm ơn bạn đã sử dụng bot này!'));
                rl.close();
                process.exit(0);
            default: console.log(chalk.red('❌ Lựa chọn không hợp lệ!'));
        }
    }
}

// Start the program
showMenu();
