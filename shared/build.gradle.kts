plugins {
    kotlin("multiplatform") version "2.0.0"
    kotlin("plugin.serialization") version "2.0.0"
    id("com.squareup.sqldelight") version "2.0.1"
}

kotlin {
    // Целевые платформы
    androidTarget()
    iosX64()
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        val commonMain by getting {
            dependencies {
                // Сериализация
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
                // Корутины
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
                // Дата/время
                implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.0")
                // HTTP клиент
                implementation("io.ktor:ktor-client-core:2.3.9")
                implementation("io.ktor:ktor-client-content-negotiation:2.3.9")
                implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.9")
                // DI
                implementation("io.insert-koin:koin-core:3.5.3")
                // Логирование
                implementation("io.github.aakira:napier:2.7.1")
                // Криптография (libsodium)
                implementation("com.ionspin.kotlin:multiplatform-crypto-libsodium-bindings:0.9.2")
                // Настройки
                implementation("com.russhwolf:multiplatform-settings:1.1.1")
            }
        }

        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
            }
        }

        val androidMain by getting {
            dependencies {
                implementation("io.ktor:ktor-client-okhttp:2.3.9")
                implementation("app.cash.sqldelight:android-driver:2.0.1")
            }
        }

        val iosMain by creating {
            dependsOn(commonMain)
            dependencies {
                implementation("io.ktor:ktor-client-darwin:2.3.9")
                implementation("app.cash.sqldelight:native-driver:2.0.1")
            }
        }

        val iosX64Main by getting { dependsOn(iosMain) }
        val iosArm64Main by getting { dependsOn(iosMain) }
        val iosSimulatorArm64Main by getting { dependsOn(iosMain) }
    }
}
