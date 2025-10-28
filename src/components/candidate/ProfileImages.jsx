"use client";
export default function ProfileImages({ selfieUrl, idDocUrl }) {
  if (!selfieUrl && !idDocUrl) return null;
  return (
    <div className="rounded-2xl border bg-white p-4 mt-4">
      <h3 className="text-lg font-semibold text-black mb-3">Profile Data</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {selfieUrl ? (
          <div>
            <div className="text-sm text-gray-600 mb-1">Selfie</div>
            <div>
              <a href={selfieUrl} target="_blank" rel="noreferrer">
                <div>
                  <img src={selfieUrl} alt="Selfie" className="rounded-lg border max-h-72 object-contain w-full" />
                </div>
              </a>
            </div>
          </div>
        ) : null}
        {idDocUrl ? (
          <div>
            <div className="text-sm text-gray-600 mb-1">Document</div>
            <a href={idDocUrl} target="_blank" rel="noreferrer">
              <img src={idDocUrl} alt="ID Document" className="rounded-lg border max-h-72 object-contain w-full" />
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
