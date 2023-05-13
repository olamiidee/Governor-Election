// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

contract GovernorElection {
    uint public totalContesters;
    uint public startTime;
    uint public nominationTime;
    uint public electionTime;
    uint public nominationFee;

    struct Contester {
        uint id;
        string name;
        string image;
        uint age;
        string politicalParty;
        string manifesto;
        uint totalVote;
    }

    Contester[] internal contesters;
    mapping(address => bool) hasVoted;

    constructor(uint _nominationTime, uint _electionTime, uint _nominationFee) {
        nominationFee = _nominationFee;
        nominationTime = _nominationTime;
        electionTime = _electionTime;
        startTime = block.timestamp;
    }

    function contest(
        string memory _name,
        uint _age,
        string memory _image,
        string memory _party,
        string memory _manifesto
    ) public payable {
        require(
            msg.value >= nominationFee,
            "Please attach the nomination fee!"
        );
        require(
            block.timestamp < startTime + nominationTime,
            "Nomination has ended!"
        );
        Contester memory newContester = Contester(
            totalContesters,
            _name,
            _image,
            _age,
            _party,
            _manifesto,
            0
        );
        contesters.push(newContester);
        totalContesters++;
    }

    function getContester(uint _id) public view returns (Contester memory) {
        return contesters[_id];
    }

    function vote(uint _id) public {
        require(
            block.timestamp < startTime + nominationTime + electionTime,
            "Election has ended"
        );
        require(hasVoted[msg.sender], "You have already voted!");
        hasVoted[msg.sender] = true;
        contesters[_id].totalVote++;
    }

    function checkWinner() public view returns (Contester memory) {
        require(
            block.timestamp >= startTime + nominationTime + electionTime,
            "Election has not ended"
        );
        uint max = 0;
        Contester memory _winner;
        for (uint i = 0; i < contesters.length; i++) {
            if (contesters[i].totalVote > max) {
                _winner = contesters[i];
                max = contesters[i].totalVote;
            }
        }
        return _winner;
    }

    function getNominationEndTime() public view returns (uint) {
        return (startTime + nominationTime);
    }

    function getVotingEndTime() public view returns (uint) {
        return (startTime + nominationTime + electionTime);
    }
}
