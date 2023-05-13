import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
import governorElection from "../contract/governorElection.json";
const governorAbi = governorElection.abi;
const governorBytecode = governorElection.bytecode;

let ContractAddress = "";
let kit;
let contract;
let contesters = [];
let hasVoted = false;
let nominationEndTime;
let electionEndTime;

const connectCeloWallet = async function () {
  if (window.celo) {
    notification("⚠️ Please approve this DApp to use it.");
    try {
      await window.celo.enable();
      notificationOff();

      const web3 = new Web3(window.celo);
      kit = newKitFromWeb3(web3);

      const accounts = await kit.web3.eth.getAccounts();
      kit.defaultAccount = accounts[0];
    } catch (error) {
      notification(`⚠️ ${error}.`);
    }
  } else {
    notification("⚠️ Please install the CeloExtensionWallet.");
  }
};

const getBalance = async function () {
  const balance = await kit.web3.eth.getBalance(kit.defaultAccount);
  const celoBalance = parseFloat(kit.web3.utils.fromWei(balance)).toFixed(2);
  document.querySelector("#balance").textContent = celoBalance;
};

function notification(_text) {
  document.querySelector(".alert").style.display = "block";
  document.querySelector("#notification").textContent = _text;
}

function notificationOff() {
  document.querySelector(".alert").style.display = "none";
}

window.addEventListener("load", async () => {
  notification("⌛ Loading...");
  await connectCeloWallet();
  await getBalance();
  notificationOff();
});

const getContestants = async function () {
  const _total = await contract.methods.totalContesters().call();
  const _contesters = [];
  for (let i = 0; i < _total; i++) {
    let _contester = new Promise(async (resolve, reject) => {
      let p = await contract.methods.getContester(i).call();
      resolve({
        id: Number(p[0]),
        name: p[1],
        image: p[2],
        age: Number(p[3]),
        party: p[4],
        manifesto: p[5],
        totalVote: Number(p[6])
      });
    });
    _contesters.push(_contester);
  }
  contesters = await Promise.all(_contesters);
  renderContesters();
};

function renderContesters() {
  document.getElementById("vote").innerHTML = "";
  contesters.forEach((_contester) => {
    const newDiv = document.createElement("div");
    newDiv.className = "col-md-4";
    newDiv.innerHTML = contesterTemplate(_contester);
    document.getElementById("vote").appendChild(newDiv);
  });
}

function contesterTemplate(_contester) {
  return `
  <div class="card mb-4">
    <img class="card-img-top" src="${_contester.image}" alt="...">
    <div class="card-body text-left p-4 position-relative">
      <div class="translate-middle-y position-absolute top-0">
      ${identiconTemplate(_contester.image)}
      </div>
      <h2 class="card-title fs-4 fw-bold mt-2">${_contester.name}</h2>
      <h5 ">Age: ${_contester.age}</h5>
      <p class="card-text mb-4" style="min-height: 82px">
        ${_contester.manifesto}             
      </p>
      <p class="card-text mt-4">
        <i class="bi bi-geo-alt-fill"></i>
        <span>Total Votes: ${Intl.NumberFormat().format(_contester.totalVote)}</span>
      </p>
      ${(electionEndTime < Date.now() && nominationEndTime > Date.now) ?
      _contester.hasVoted ?
        "<p class='text-danger'>You have already voted</p>" :
        `<div class="d-grid gap-2">
              <a class="btn btn-lg btn-outline-dark vote fs-6 p-3" id=${_contester.id}>
                Vote
              </a>
            </div>` : ""
    }
    </div>
  </div>
`;
}

function identiconTemplate(image) {
  return `
<div class="rounded-circle overflow-hidden d-inline-block border border-white border-2 shadow-sm m-0">
  <a href=${image}
      target="_blank">
      <img src="${image}" width="48" alt="${image}">
  </a>
</div>
`;
}

document.querySelector("#vote").addEventListener("click", async (e) => {
  if (e.target.className.includes("vote")) {
    const id = e.target.id;
    notification(`⌛ Voting for "${contesters[id].name}"...`);
    try {
      const result = await contract.methods.vote(id).send({
        from: kit.defaultAccount,
      });
      notification(
        `🎉 You successfully voted for "${contesters[id].name}".`
      );
      getContestants();
      getBalance();
    } catch (error) {
      notification(`⚠️ ${error}.`);
    }
  }
});

async function showElection() {
  document.getElementById("noelection").style.display = "none";
  document.getElementById("election").style.display = "block";
  document.getElementById("ContractAddress").innerText = ContractAddress;
  notification("⌛ Loading...");
  electionEndTime = Number(await contract.methods.getVotingEndTime().call()) * 1000;
  const currentTime = new Date().getTime();
  console.log(electionEndTime);
  if (electionEndTime > currentTime) {
    nominationEndTime = Number(await contract.methods.getNominationEndTime().call()) * 1000;
    let nominationFee = kit.web3.utils.fromWei(await contract.methods.nominationFee().call());
    if (nominationEndTime > currentTime) {
      document.getElementById("nominationTimeLeft").innerText = `Registration ends: ${new Date(nominationEndTime).toLocaleString("en-GB", { "dateStyle": "long", "timeStyle": "short" })}`
      document.getElementById("nominationFee").innerText = `Registration fee: ${nominationFee} CELO`
    } else {
      document.getElementById("electionTimeLeft").innerText = `Voting ends: ${new Date(electionEndTime).toLocaleString("en-GB", { "dateStyle": "long", "timeStyle": "short", "hour12": true })}`
    }
  } else {
    let electionWinner = Number(await contract.methods.checkWinner().call());
    document.getElementById("electionWinner").innerText = `🎉Winner: ${electionWinner[1]}`
  }
  await getContestants();
  notificationOff();
}

document
  .querySelector("#createElection")
  .addEventListener("click", async (e) => {

    try {
      const args = [
        document.getElementById("nominationTime").value * 3600,
        document.getElementById("votingTime").value * 3600,
        kit.web3.utils.toWei(document.getElementById("fee").value),
      ];
      notification(`⌛ Creating new election...`);
      const myContract = new kit.web3.eth.Contract(governorAbi);
      const deployTx = await myContract.deploy({
        data: governorBytecode,
        arguments: args
      });

      const receipt = await kit.web3.eth.sendTransaction(
        {
          from: kit.defaultAccount,
          data: deployTx.encodeABI(),
          gas: await deployTx.estimateGas(),
        }
      )
      ContractAddress = receipt.contractAddress;
      contract = new kit.web3.eth.Contract(governorAbi, ContractAddress);
      showElection();
      notification(`🎉 Election successfully created!`);

    } catch (error) {
      console.log(error);
      notification(`⚠️ ${error}.`);
    }
  });

document
  .querySelector("#viewElection")
  .addEventListener("click", async (e) => {
    ContractAddress = document.getElementById("electionAddress").value;
    if (!ContractAddress || ContractAddress.length < 32) {
      notification(`⚠️ No contract address provided!`);
      return;
    }

    try {
      contract = new kit.web3.eth.Contract(governorAbi, ContractAddress);
      showElection();
    } catch (error) {
      notification(`⚠️ ${error}.`);
    }
  });

document
  .querySelector("#contestAsGovernor")
  .addEventListener("click", async (e) => {
    const params = [
      document.getElementById("newGovernorName").value,
      document.getElementById("age").value,
      document.getElementById("image").value,
      document.getElementById("party").value,
      document.getElementById("manifesto").value,
    ];
    notification(`⌛ Adding new contestant: "${params[0]}" ...`);

    try {
      const nominationFee = await contract.methods.nominationFee().call();
      const result = await contract.methods
        .contest(...params)
        .send({ from: kit.defaultAccount, value: nominationFee });
      getContestants()
      notification(`🎉 New contestant successfully added: "${params[0]}".`);
    } catch (error) {
      console.log({ error })
      notification(`⚠️ ${error}.`);
    }
  });
