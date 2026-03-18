package com.son

import com.son.domain.CreateSecretChatUseCase
import com.son.model.ChatType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DomainTest {

    @Test
    fun testCreateSecretChat() {
        val useCase = CreateSecretChatUseCase()
        val result = useCase.execute("user-123", "Алексей")

        assertEquals(ChatType.SECRET, result.chat.type)
        assertEquals("Алексей", result.chat.name)
        assertTrue(result.sharedSecret.isNotEmpty())
        assertEquals(1, result.ratchetIndex)
    }

    @Test
    fun testSecretChatUniqueIds() {
        val useCase = CreateSecretChatUseCase()
        val r1 = useCase.execute("user-1", "Боб")
        val r2 = useCase.execute("user-2", "Алиса")

        assertTrue(r1.chat.id != r2.chat.id)
    }
}
