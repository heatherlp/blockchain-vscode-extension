/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/
'use strict';
// tslint:disable no-unused-expression
import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as path from 'path';
import { TestUtil } from '../TestUtil';
import { UserInputUtil } from '../../src/commands/UserInputUtil';
import { BlockchainTreeItem } from '../../src/explorer/model/BlockchainTreeItem';
import { BlockchainRuntimeExplorerProvider } from '../../src/explorer/runtimeOpsExplorer';
import * as myExtension from '../../src/extension';
import { PackageRegistryEntry } from '../../src/packages/PackageRegistryEntry';
import { VSCodeBlockchainOutputAdapter } from '../../src/logging/VSCodeBlockchainOutputAdapter';
import { LogType } from '../../src/logging/OutputAdapter';
import { FabricRuntimeManager } from '../../src/fabric/FabricRuntimeManager';
import { SmartContractsTreeItem } from '../../src/explorer/runtimeOps/SmartContractsTreeItem';
import { InstantiateCommandTreeItem } from '../../src/explorer/runtimeOps/InstantiateCommandTreeItem';
import { ChannelsOpsTreeItem } from '../../src/explorer/runtimeOps/ChannelsOpsTreeItem';
import { ExtensionCommands } from '../../ExtensionCommands';
import { VSCodeBlockchainDockerOutputAdapter } from '../../src/logging/VSCodeBlockchainDockerOutputAdapter';
import { FabricRuntimeConnection } from '../../src/fabric/FabricRuntimeConnection';
import { Reporter } from '../../src/util/Reporter';

chai.use(sinonChai);

describe('InstantiateCommand', () => {
    const mySandBox: sinon.SinonSandbox = sinon.createSandbox();

    before(async () => {
        await TestUtil.setupTests(mySandBox);
    });

    describe('InstantiateSmartContract', () => {
        let fabricRuntimeMock: sinon.SinonStubbedInstance<FabricRuntimeConnection>;

        let executeCommandStub: sinon.SinonStub;
        let logSpy: sinon.SinonSpy;
        let dockerLogsOutputSpy: sinon.SinonSpy;
        let showChannelQuickPickStub: sinon.SinonStub;
        let showChaincodeAndVersionQuickPick: sinon.SinonStub;
        let showInputBoxStub: sinon.SinonStub;
        let isRunningStub: sinon.SinonStub;

        let allChildren: Array<BlockchainTreeItem>;
        let blockchainRuntimeExplorerProvider: BlockchainRuntimeExplorerProvider;
        let instantiateCommandTreeItem: InstantiateCommandTreeItem;
        let smartContractsChildren: BlockchainTreeItem[];
        let channelsChildren: BlockchainTreeItem[];
        let showYesNo: sinon.SinonStub;
        let sendTelemetryEventStub: sinon.SinonStub;

        beforeEach(async () => {
            executeCommandStub = mySandBox.stub(vscode.commands, 'executeCommand');
            executeCommandStub.withArgs(ExtensionCommands.CONNECT).resolves();
            executeCommandStub.withArgs(ExtensionCommands.START_FABRIC).resolves();
            executeCommandStub.callThrough();

            fabricRuntimeMock = sinon.createStubInstance(FabricRuntimeConnection);
            fabricRuntimeMock.connect.resolves();
            fabricRuntimeMock.instantiateChaincode.resolves();

            const fabricRuntimeManager: FabricRuntimeManager = FabricRuntimeManager.instance();
            mySandBox.stub(fabricRuntimeManager, 'getConnection').resolves((fabricRuntimeMock));
            isRunningStub = mySandBox.stub(FabricRuntimeManager.instance().getRuntime(), 'isRunning').resolves(true);

            showChannelQuickPickStub = mySandBox.stub(UserInputUtil, 'showChannelQuickPickBox').resolves({
                label: 'myChannel',
                data: ['peerOne']
            });

            showChaincodeAndVersionQuickPick = mySandBox.stub(UserInputUtil, 'showChaincodeAndVersionQuickPick').withArgs(sinon.match.any, ['peerOne']).resolves(
                {
                    label: 'myContract@0.0.1',
                    data: {
                        packageEntry: {
                            name: 'myContract',
                            version: '0.0.1',
                            path: undefined
                        } as PackageRegistryEntry,
                        workspace: undefined
                    }
                }
            );

            showInputBoxStub = mySandBox.stub(UserInputUtil, 'showInputBox');
            showInputBoxStub.onFirstCall().resolves('instantiate');
            showInputBoxStub.onSecondCall().resolves('["arg1", "arg2", "arg3"]');

            showYesNo = mySandBox.stub(UserInputUtil, 'showQuickPickYesNo').resolves(UserInputUtil.NO);

            logSpy = mySandBox.spy(VSCodeBlockchainOutputAdapter.instance(), 'log');
            dockerLogsOutputSpy = mySandBox.spy(VSCodeBlockchainDockerOutputAdapter.instance(), 'show');
            sendTelemetryEventStub = mySandBox.stub(Reporter.instance(), 'sendTelemetryEvent');

            fabricRuntimeMock.getAllPeerNames.returns(['peerOne']);

            fabricRuntimeMock.getInstantiatedChaincode.resolves([]);
            const map: Map<string, Array<string>> = new Map<string, Array<string>>();
            map.set('myChannel', ['peerOne']);
            fabricRuntimeMock.createChannelMap.resolves(map);

            blockchainRuntimeExplorerProvider = myExtension.getBlockchainRuntimeExplorerProvider();
            allChildren = await blockchainRuntimeExplorerProvider.getChildren();

            const smartContracts: SmartContractsTreeItem = allChildren[0] as SmartContractsTreeItem;
            smartContractsChildren = await blockchainRuntimeExplorerProvider.getChildren(smartContracts);
            const instantiatedSmartContractsList: BlockchainTreeItem[] = await blockchainRuntimeExplorerProvider.getChildren(smartContractsChildren[1]);
            instantiateCommandTreeItem = instantiatedSmartContractsList[0] as InstantiateCommandTreeItem;

            const channels: ChannelsOpsTreeItem = allChildren[1] as ChannelsOpsTreeItem;
            channelsChildren = await blockchainRuntimeExplorerProvider.getChildren(channels);
        });

        afterEach(async () => {
            await vscode.commands.executeCommand(ExtensionCommands.DISCONNECT);
            mySandBox.restore();
        });

        it('should instantiate the smart contract through the command', async () => {
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('myContract', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should instantiate the smart contract through the command when not connected', async () => {
            isRunningStub.onCall(4).resolves(false);
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            executeCommandStub.should.have.been.calledWith(ExtensionCommands.START_FABRIC);
            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('myContract', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should stop if starting the local_fabric fails', async () => {
            isRunningStub.resolves(false);
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            executeCommandStub.should.have.been.calledWith(ExtensionCommands.START_FABRIC);
            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;

            logSpy.should.have.been.calledOnceWithExactly(LogType.INFO, undefined, 'instantiateSmartContract');
        });

        it('should instantiate the smart contract through the command with collection', async () => {
            showYesNo.resolves(UserInputUtil.YES);
            mySandBox.stub(UserInputUtil, 'getWorkspaceFolders').returns([]);
            mySandBox.stub(UserInputUtil, 'browse').resolves(path.join('myPath'));
            executeCommandStub.withArgs(ExtensionCommands.INSTALL_SMART_CONTRACT, undefined, ['peerOne'], { name: 'biscuit-network', version: '0.0.2', path: undefined }).resolves({ name: 'biscuit-network', version: '0.0.2', path: undefined });

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('myContract', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], 'myPath');

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should instantiate the smart contract through the command with collection and set dialog folder', async () => {
            showYesNo.resolves(UserInputUtil.YES);

            const workspaceFolder: any = {
                name: 'myFolder',
                uri: vscode.Uri.file('myPath')
            };

            mySandBox.stub(UserInputUtil, 'getWorkspaceFolders').returns([workspaceFolder]);
            const showBrowse: sinon.SinonStub = mySandBox.stub(UserInputUtil, 'browse').resolves(path.join('myPath'));
            executeCommandStub.withArgs(ExtensionCommands.INSTALL_SMART_CONTRACT, undefined, ['peerOne'], { name: 'biscuit-network', version: '0.0.2', path: undefined }).resolves({ name: 'biscuit-network', version: '0.0.2', path: undefined });

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            showBrowse.should.have.been.calledWith(sinon.match.any, sinon.match.any, {
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Select',
                defaultUri: vscode.Uri.file(path.join('myPath'))
            });

            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('myContract', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], 'myPath');

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should handle cancel when choosing if want collection', async () => {
            showYesNo.resolves();
            executeCommandStub.withArgs(ExtensionCommands.INSTALL_SMART_CONTRACT, undefined, ['peerOne'], { name: 'biscuit-network', version: '0.0.2', path: undefined }).resolves({ name: 'biscuit-network', version: '0.0.2', path: undefined });

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;
        });

        it('should handle cancel when choosing collection path', async () => {
            showYesNo.resolves(UserInputUtil.YES);
            mySandBox.stub(UserInputUtil, 'browse').resolves();
            executeCommandStub.withArgs(ExtensionCommands.INSTALL_SMART_CONTRACT, undefined, ['peerOne'], { name: 'biscuit-network', version: '0.0.2', path: undefined }).resolves({ name: 'biscuit-network', version: '0.0.2', path: undefined });

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;
        });

        it('should handle choosing channel being cancelled', async () => {
            showChannelQuickPickStub.resolves();

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;
            dockerLogsOutputSpy.should.not.been.called;
            logSpy.should.have.been.calledOnceWithExactly(LogType.INFO, undefined, 'instantiateSmartContract');
        });

        it('should handle error from instantiating smart contract', async () => {
            const error: Error = new Error('some error');

            fabricRuntimeMock.instantiateChaincode.rejects(error);

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('myContract', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.ERROR, `Error instantiating smart contract: ${error.message}`, `Error instantiating smart contract: ${error.toString()}`);
            sendTelemetryEventStub.should.not.have.been.called;
        });

        it('should handle cancel when choosing chaincode and version', async () => {
            showChaincodeAndVersionQuickPick.resolves();

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;

            dockerLogsOutputSpy.should.not.been.called;
            logSpy.should.have.been.calledOnceWithExactly(LogType.INFO, undefined, 'instantiateSmartContract');
        });

        it('should instantiate smart contract through the tree by clicking + Instantiate in the runtime ops view', async () => {
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT, instantiateCommandTreeItem);

            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('myContract', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should instantiate smart contract through the tree by right-clicking Instantiated in the runtime ops view', async () => {
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT, smartContractsChildren[0]);

            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('myContract', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should instantiate smart contract through the tree by right-clicking on channel in the runtime ops view', async () => {
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT, channelsChildren[0]);

            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('myContract', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should instantiate the smart contract through the command with no function', async () => {
            showInputBoxStub.onFirstCall().resolves('');
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWithExactly('myContract', '0.0.1', ['peerOne'], 'myChannel', '', [], undefined);
            showInputBoxStub.should.have.been.calledOnce;

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should instantiate the smart contract through the command with function but no args', async () => {
            showInputBoxStub.onFirstCall().resolves('instantiate');
            showInputBoxStub.onSecondCall().resolves('');
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWithExactly('myContract', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', [], undefined);
            showInputBoxStub.should.have.been.calledTwice;

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should cancel instantiating when user escape entering function', async () => {
            showInputBoxStub.onFirstCall().resolves(undefined);
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;
            showInputBoxStub.should.have.been.calledOnce;
            dockerLogsOutputSpy.should.not.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.should.not.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
        });

        it('should cancel instantiating when user escape entering args', async () => {
            showInputBoxStub.onFirstCall().resolves('instantiate');
            showInputBoxStub.onSecondCall().resolves(undefined);
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;
            showInputBoxStub.should.have.been.calledTwice;

            dockerLogsOutputSpy.should.not.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.should.not.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
        });

        it('should throw error if args not valid json', async () => {
            showInputBoxStub.onFirstCall().resolves('instantiate');
            showInputBoxStub.onSecondCall().resolves('["wrong]');
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;
            showInputBoxStub.should.have.been.calledTwice;

            dockerLogsOutputSpy.should.not.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.should.have.been.calledWith(LogType.ERROR, 'Error with instantiate function arguments: Unexpected end of JSON input');
            logSpy.should.not.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
        });

        it('should throw error if args does not start with [', async () => {
            showInputBoxStub.onFirstCall().resolves('instantiate');
            showInputBoxStub.onSecondCall().resolves('{"name": "bob"}');
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;
            showInputBoxStub.should.have.been.calledTwice;

            dockerLogsOutputSpy.should.not.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.should.have.been.calledWith(LogType.ERROR, 'Error with instantiate function arguments: instantiate function arguments should be in the format ["arg1", {"key" : "value"}]');
            logSpy.should.not.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
        });

        it('should throw error if args does not end with ]', async () => {
            showInputBoxStub.onFirstCall().resolves('instantiate');
            showInputBoxStub.onSecondCall().resolves('1');
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
            fabricRuntimeMock.instantiateChaincode.should.not.have.been.called;
            showInputBoxStub.should.have.been.calledTwice;

            dockerLogsOutputSpy.should.not.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.should.have.been.calledWith(LogType.ERROR, 'Error with instantiate function arguments: instantiate function arguments should be in the format ["arg1", {"key" : "value"}]');
            logSpy.should.not.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
        });

        it('should install and instantiate package', async () => {
            executeCommandStub.withArgs(ExtensionCommands.INSTALL_SMART_CONTRACT, undefined, ['peerOne'], { name: 'somepackage', version: '0.0.1', path: undefined }).resolves({ name: 'somepackage', version: '0.0.1', path: undefined });

            showChaincodeAndVersionQuickPick.resolves({
                label: 'somepackage@0.0.1',
                description: 'Packaged',
                data: {
                    packageEntry: {
                        name: 'somepackage',
                        version: '0.0.1',
                        path: undefined
                    },
                    workspace: undefined
                }
            });

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('somepackage', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should be able to cancel install and instantiate for package', async () => {
            executeCommandStub.withArgs(ExtensionCommands.INSTALL_SMART_CONTRACT, undefined, ['peerOne'], { name: 'somepackage', version: '0.0.1', path: undefined }).resolves();

            showChaincodeAndVersionQuickPick.resolves({
                label: 'somepackage@0.0.1',
                description: 'Packaged',
                data: {
                    packageEntry: {
                        name: 'somepackage',
                        version: '0.0.1',
                        path: undefined
                    },
                    workspace: undefined
                }
            });

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            fabricRuntimeMock.instantiateChaincode.should.not.been.calledWith('somepackage', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);
            dockerLogsOutputSpy.should.not.have.been.called;
            logSpy.should.have.been.calledOnceWithExactly(LogType.INFO, undefined, 'instantiateSmartContract');
        });

        it('should package, install and instantiate a project', async () => {
            executeCommandStub.withArgs(ExtensionCommands.PACKAGE_SMART_CONTRACT).resolves({ name: 'somepackage', version: '0.0.1', path: undefined });
            executeCommandStub.withArgs(ExtensionCommands.INSTALL_SMART_CONTRACT, undefined, ['peerOne'], { name: 'somepackage', version: '0.0.1', path: undefined }).resolves({ name: 'somepackage', version: '0.0.1', path: undefined });

            showChaincodeAndVersionQuickPick.resolves({
                label: 'somepackage@0.0.1',
                description: 'Open Project',
                data: {
                    packageEntry: undefined,
                    workspace: mySandBox.stub()
                }
            });

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('somepackage', '0.0.1', ['peerOne'], 'myChannel', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should be able to cancel a project packaging, installing and instantiating', async () => {
            executeCommandStub.withArgs(ExtensionCommands.PACKAGE_SMART_CONTRACT).resolves({ name: 'somepackage', version: '0.0.1', path: undefined });
            executeCommandStub.withArgs(ExtensionCommands.INSTALL_SMART_CONTRACT, undefined, ['peerOne'], { name: 'somepackage', version: '0.0.1', path: undefined }).resolves();

            showChaincodeAndVersionQuickPick.resolves({
                label: 'somepackage@0.0.1',
                description: 'Open Project',
                data: {
                    packageEntry: undefined,
                    workspace: mySandBox.stub()
                }
            });

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            fabricRuntimeMock.instantiateChaincode.should.not.been.called;
            dockerLogsOutputSpy.should.not.have.been.called;
            logSpy.should.have.been.calledOnceWithExactly(LogType.INFO, undefined, 'instantiateSmartContract');
        });

        it('should be able to handle a project failing to package', async () => {
            executeCommandStub.withArgs(ExtensionCommands.PACKAGE_SMART_CONTRACT).resolves();

            showChaincodeAndVersionQuickPick.resolves({
                label: 'somepackage@0.0.1',
                description: 'Open Project',
                data: {
                    packageEntry: undefined,
                    workspace: mySandBox.stub()
                }
            });

            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT);

            fabricRuntimeMock.instantiateChaincode.should.not.been.called;
            logSpy.should.have.been.calledOnceWithExactly(LogType.INFO, undefined, 'instantiateSmartContract');
        });

        it('should instantiate a debug package when called from the debug command list', async () => {
            executeCommandStub.withArgs(ExtensionCommands.PACKAGE_SMART_CONTRACT).resolves({ name: 'beer', version: 'vscode-debug-123456', path: undefined });
            executeCommandStub.withArgs(ExtensionCommands.INSTALL_SMART_CONTRACT).resolves({ name: 'beer', version: 'vscode-debug-123456', path: undefined });

            const workspaceFolder: any = {
                name: 'beer',
                uri: vscode.Uri.file('myPath')
            };
            mySandBox.stub(UserInputUtil, 'getWorkspaceFolders').returns([workspaceFolder]);
            const activeDebugSessionStub: any = {
                configuration: {
                    env: {
                        CORE_CHAINCODE_ID_NAME: 'beer:vscode-debug-123456'
                    }
                }
            };

            mySandBox.stub(vscode.debug, 'activeDebugSession').value(activeDebugSessionStub);
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT, undefined, 'someChannelName', ['peerHi', 'peerHa']);

            fabricRuntimeMock.instantiateChaincode.should.have.been.calledWith('beer', 'vscode-debug-123456', ['peerHi', 'peerHa'], 'someChannelName', 'instantiate', ['arg1', 'arg2', 'arg3'], undefined);

            dockerLogsOutputSpy.should.have.been.called;
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'instantiateSmartContract');
            logSpy.getCall(1).should.have.been.calledWith(LogType.SUCCESS, 'Successfully instantiated smart contract');
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.PACKAGE_SMART_CONTRACT);
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.INSTALL_SMART_CONTRACT);
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('instantiateCommand');
        });

        it('should hand the package command failing when called the command is called during a debug session', async () => {
            executeCommandStub.withArgs(ExtensionCommands.PACKAGE_SMART_CONTRACT).resolves();

            const workspaceFolder: any = {
                name: 'beer',
                uri: vscode.Uri.file('myPath'),
            };
            const activeDebugSessionStub: any = {
                configuration: {
                    env: {
                        CORE_CHAINCODE_ID_NAME: 'beer:vscode-debug-123456'
                    }
                },
                workspaceFolder: workspaceFolder
            };

            mySandBox.stub(vscode.debug, 'activeDebugSession').value(activeDebugSessionStub);
            await vscode.commands.executeCommand(ExtensionCommands.INSTANTIATE_SMART_CONTRACT, undefined, 'someChannelName', ['peerHi', 'peerHa']);

            fabricRuntimeMock.instantiateChaincode.should.not.been.called;
            dockerLogsOutputSpy.should.not.have.been.called;
            logSpy.should.have.been.calledOnceWithExactly(LogType.INFO, undefined, 'instantiateSmartContract');
        });
    });
});
