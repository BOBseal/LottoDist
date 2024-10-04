import express from 'express';
import { ethers } from 'ethers';
import dotenv from "dotenv"
import fs from "fs/promises"
import axios from 'axios';
import fetch from 'node-fetch';

import LotteryAbi from './Utils/OILPOT_ERC20.json' assert { type: 'json' }
import TokenAbi from './Utils/ERC20.json' assert { type: 'json' }


dotenv.config();

const app = express();

const port = process.env.PORT || 7000;
const basePath = './db/';

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet =  new ethers.Wallet(process.env.MANAGER_KEY,provider);

const addressConfig = {
  "USDC":{tokenAddress:"0xe75D0fB2C24A55cA1e3F96781a2bCC7bdba058F0",lotteryContract:"0xF617A31A61E3d02CcEF4eC11202d377eDB2b84D7"},
  "WETH":{tokenAddress:"0x4200000000000000000000000000000000000006",lotteryContract:"0x228D6B4c1DA545422B05b2d8cC21a608E4619c93"},
  "WBTC":{tokenAddress:"0x03C7054BCB39f7b2e5B2c7AcB37583e32D70Cfa3",lotteryContract:"0x5393B1d1bA6058Ceb42E012036161E30ACD0825c"},
  "UNIBTC":{tokenAddress:"0x236f8c0a61dA474dB21B693fB2ea7AAB0c803894",lotteryContract:"0x4A0E0dfc66c8995708c3499559374a0A2e260a1e"},
  "WRP":{tokenAddress:"0xc5d16A63ac69591BDC10912ee49aB5FAa3FEC5Ea",lotteryContract:"0x6e921afBEdf8CAcC77e3Ae4Ab144B972550B6BD8"},
}

const activeDistributions =[
  "WRP",
  "WETH",
  "UNIBTC",
  "WBTC",
  "USDC"
]

const delay = async(ms) => new Promise(resolve => setTimeout(resolve, ms));

//=> returns lotteryCa & TokenCa
const getContractsByTicker = async(ticker)=>{
  try {
    const obj = addressConfig[ticker];
    //console.log(obj)
    const lotteryCa =new ethers.Contract(obj.lotteryContract,LotteryAbi.abi,wallet);
    const tokenCa = new ethers.Contract(obj.tokenAddress,TokenAbi.abi,wallet);
    return {lotteryCa:lotteryCa , tokenCa:tokenCa}
  } catch (error) {
    console.log(error)
  }
}

async function readFile(index) {
  try {
      const _path = `${basePath}${index}.json`
      const data = await fs.readFile(_path, 'utf8');
      const pData = JSON.parse(data);
      return pData;
  } catch (error) {
      console.error('Error reading JSON file:', error);
      throw error;
  }
}

async function writeJsonFile(index, data) {
  try {
      const _path = `${basePath}${index}.json`
      const jsonData = JSON.stringify(data, null, 2); 
      await fs.writeFile(_path, jsonData, 'utf8');
      return true;
  } catch (error) {
      console.error('Error writing JSON file:', error);
      throw error;
  }
}

function getRandomNumberInRange(startNo, endNo) {
  // Ensure that startNo is less than endNo
  if (startNo > endNo) {
      throw new Error("startNo must be less than or equal to endNo");
  }
  
  // Generate a random number in the range
  const randomNum = Math.random() * (endNo - startNo) + startNo;
  
  // Return a random integer within the range
  return Math.floor(randomNum);
}

async function distributeRewards() {
  try {
    console.log("Starting")
    for(const ticker of activeDistributions){
      console.log(`processing ${ticker}`)
      let winList =[]
      const caObj =await getContractsByTicker(ticker);
      const lotteryCa = caObj.lotteryCa;
      const tokenCa = caObj.tokenCa;
      const startRange =0;
      const cr = await lotteryCa.currentRound();
      const ongoingRound = Number(cr)
      const mp = await lotteryCa.maxTicketsPerRound();
      const maxParticipants = Number(mp);
      const tL = await lotteryCa.roundTicketsLeft(ongoingRound);
      const ticketsLeft = Number(tL);
      const mw = await lotteryCa.maxWinners();
      const maxWinners = Number(mw);
      console.log(ticketsLeft);
      if(ticketsLeft == 0){
        const generatedIndices = new Set();
        while (winList.length < maxWinners){
          const winIndex = getRandomNumberInRange(startRange,(maxParticipants-1))          
          
          if (!generatedIndices.has(winIndex)) {
            generatedIndices.add(winIndex);
            const wTicket = await lotteryCa.getRoundParticipants(ongoingRound, winIndex);
            console.log(`Index: ${winIndex}, Ticket: ${wTicket[0]}`);
            winList.push(wTicket);
          }
        }
        if(winList.length == maxWinners){
          const txSubmit= await lotteryCa.distributeAndStartNextRound(winList);
        } else {
          console.log("Winlist length error")
        }
      }
    }
  } catch (error) {
    console.log(error)
  }
}
distributeRewards();
setInterval(()=>distributeRewards(), 80 *1000);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
