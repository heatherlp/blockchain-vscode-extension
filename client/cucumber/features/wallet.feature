Feature: Fabric Wallets
    Test all the features of a fabric wallet

    Scenario: local fabric wallet is created automatically
        Given the Local Fabric is running
        And the 'Local Fabric' wallet
        Then there should be a tree item with a label 'local_fabric_wallet' in the 'Fabric Wallets' panel
        And the tree item should have a tooltip equal to 'local_fabric_wallet'
        And there should be a identity tree item with a label 'admin ⭑' in the 'Fabric Wallets' panel for item local_fabric_wallet
        And the tree item should have a tooltip equal to 'admin'

    @otherFabric
    Scenario: create a new wallet using certs
        When I create a wallet 'myWallet' using certs with identity name 'conga' and mspid 'Org1MSP'
        Then there should be a tree item with a label 'myWallet' in the 'Fabric Wallets' panel
        And the tree item should have a tooltip equal to 'myWallet'
        And there should be a identity tree item with a label 'conga' in the 'Fabric Wallets' panel for item myWallet
        And the tree item should have a tooltip equal to 'conga'

    @otherFabric
    Scenario: create a new wallet using an enrollId and secret
        Given the gateway 'myGateway' is created
        When I create a wallet 'myOtherWallet' using enrollId with identity name 'biscuit' and mspid 'Org1MSP'
        Then there should be a tree item with a label 'myOtherWallet' in the 'Fabric Wallets' panel
        And the tree item should have a tooltip equal to 'myOtherWallet'
        And there should be a identity tree item with a label 'biscuit' in the 'Fabric Wallets' panel for item myOtherWallet
        And the tree item should have a tooltip equal to 'biscuit'

    @otherFabric
    Scenario: add a new identity using a json file
        Given the wallet 'myOtherWallet' with identity 'biscuit' and mspid 'Org1MSP' exists
        When I create an identity using json file with identity name 'secondBiscuit' and mspid 'Org1MSP' in wallet 'myOtherWallet'
        Then there should be a identity tree item with a label 'secondBiscuit' in the 'Fabric Wallets' panel for item myOtherWallet
        And the tree item should have a tooltip equal to 'secondBiscuit'

    @otherFabric
    Scenario: create a new wallet using a json file
        When I create a wallet 'myWalletyWallet' using json file with identity name 'jason' and mspid 'Org1MSP'
        Then there should be a tree item with a label 'myWalletyWallet' in the 'Fabric Wallets' panel
        And the tree item should have a tooltip equal to 'myWalletyWallet'
        And there should be a identity tree item with a label 'jason' in the 'Fabric Wallets' panel for item myWalletyWallet
        And the tree item should have a tooltip equal to 'jason'

    @otherFabric
    Scenario: add a new identity using certs
        Given the wallet 'myWalletyWallet' with identity 'jason' and mspid 'Org1MSP' exists
        When I create an identity using certs with identity name 'jasonTwo' and mspid 'Org1MSP' in wallet 'myWalletyWallet'
        Then there should be a identity tree item with a label 'jasonTwo' in the 'Fabric Wallets' panel for item myWalletyWallet
        And the tree item should have a tooltip equal to 'jasonTwo'

    @otherFabric
    Scenario: add a new identity using an enrollId and secret
        Given the gateway 'myGateway' is created
        Given the wallet 'myWalletyWallet' with identity 'jason' and mspid 'Org1MSP' exists
        When I create an identity using enrollId with identity name 'otherJason' and mspid 'Org1MSP' in wallet 'myWalletyWallet'
        Then there should be a identity tree item with a label 'otherJason' in the 'Fabric Wallets' panel for item myWalletyWallet
        And the tree item should have a tooltip equal to 'otherJason'
