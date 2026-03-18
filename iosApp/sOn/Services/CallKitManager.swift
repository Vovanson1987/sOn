import Foundation
import CallKit

/// Менеджер CallKit для интеграции звонков с системой iOS
class CallKitManager: NSObject, ObservableObject {
    private let provider: CXProvider
    private let controller = CXCallController()

    @Published var isCallActive = false
    @Published var currentCallId: UUID?

    override init() {
        let config = CXProviderConfiguration()
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportsVideo = true
        config.iconTemplateImageData = nil // TODO: добавить иконку
        config.ringtoneSound = "ringtone.caf"

        provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: nil)
    }

    /// Сообщить iOS о входящем звонке
    func reportIncomingCall(callerName: String, hasVideo: Bool, completion: @escaping (Error?) -> Void) {
        let callId = UUID()
        currentCallId = callId

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: callerName)
        update.localizedCallerName = callerName
        update.hasVideo = hasVideo

        provider.reportNewIncomingCall(with: callId, update: update) { error in
            if error == nil {
                self.isCallActive = true
            }
            completion(error)
        }
    }

    /// Начать исходящий звонок
    func startCall(contactName: String, hasVideo: Bool) {
        let callId = UUID()
        currentCallId = callId

        let handle = CXHandle(type: .generic, value: contactName)
        let action = CXStartCallAction(call: callId, handle: handle)
        action.isVideo = hasVideo

        let transaction = CXTransaction(action: action)
        controller.request(transaction) { error in
            if let error = error {
                print("Ошибка начала звонка: \(error)")
            } else {
                self.isCallActive = true
            }
        }
    }

    /// Завершить звонок
    func endCall() {
        guard let callId = currentCallId else { return }
        let action = CXEndCallAction(call: callId)
        let transaction = CXTransaction(action: action)
        controller.request(transaction) { error in
            if let error = error {
                print("Ошибка завершения звонка: \(error)")
            }
            self.isCallActive = false
            self.currentCallId = nil
        }
    }
}

extension CallKitManager: CXProviderDelegate {
    func providerDidReset(_ provider: CXProvider) {
        isCallActive = false
        currentCallId = nil
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        isCallActive = true
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        isCallActive = false
        currentCallId = nil
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        isCallActive = true
        action.fulfill()
    }
}
