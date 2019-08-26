/*
 * Copyright (C) 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef MATDBG_SHADEREDITOR_H
#define MATDBG_SHADEREDITOR_H

#include <filaflat/ChunkContainer.h>
#include <filaflat/MaterialChunk.h>

#include <backend/DriverEnums.h>

namespace filament {
namespace matdbg {

// ShaderEditor is a utility class for editing shader source within a material package.
// See also ShaderExtractor.
class ShaderEditor {
public:
    ShaderEditor(backend::Backend backend, const void* data, size_t size);
    ~ShaderEditor();
    bool applyShaderEdit(backend::ShaderModel shaderModel, uint8_t variant,
            backend::ShaderType stage, const char* source);
    const uint8_t* getEditedPackage() const;
    size_t getEditedSize() const;
private:
    backend::Backend mBackend;
    filaflat::ChunkContainer mOriginalPackage;
    filaflat::ChunkContainer* mEditedPackage = nullptr;
    filaflat::MaterialChunk mMaterialChunk;
    filamat::ChunkType mMaterialTag = filamat::ChunkType::Unknown;
    filamat::ChunkType mDictionaryTag = filamat::ChunkType::Unknown;
};

} // namespace matdbg
} // namespace filament

#endif  // MATDBG_SHADEREDITOR_H
