import React from 'react';

interface Props {
  mlsNumber?: string | null;
  idxUrl?: string | null;
  listingSource?: string | null;
  listingAgent?: string | null;
  listingBrokerage?: string | null;
  enrichmentStatus?: string | null;
}

const statusColor: Record<string, string> = {
  enriched: '#2D6A4F',
  pending_api_connection: '#C9A84C',
  manual_review_required: '#A07850',
  pending: '#6B6252',
};

const statusLabel: Record<string, string> = {
  enriched: 'Enriched',
  pending_api_connection: 'Pending API',
  manual_review_required: 'Manual Review',
  pending: 'Pending',
};

export const MlsSourcePanel: React.FC<Props> = ({
  mlsNumber, idxUrl, listingSource, listingAgent, listingBrokerage, enrichmentStatus,
}) => {
  if (!mlsNumber && !idxUrl) return null;

  const status = enrichmentStatus || 'pending';
  const color = statusColor[status] || '#6B6252';
  const label = statusLabel[status] || status;

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 28, marginBottom: 32 }}>
      <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16 }}>
        MLS / IDX Source
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {mlsNumber && (
          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>MLS #</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: '#F0EBE0' }}>{mlsNumber}</div>
          </div>
        )}
        {listingSource && (
          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>Source</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0' }}>{listingSource}</div>
          </div>
        )}
        {listingAgent && (
          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>Listing Agent</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0' }}>{listingAgent}</div>
          </div>
        )}
        {listingBrokerage && (
          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>Brokerage</div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 13, color: '#F0EBE0' }}>{listingBrokerage}</div>
          </div>
        )}
        <div>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>Enrichment</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color }}>{label}</div>
          </div>
        </div>
        {idxUrl && (
          <div>
            <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#6B6252', marginBottom: 4 }}>IDX Link</div>
            <a
              href={idxUrl}
              target="_blank"
              rel="noreferrer noopener"
              style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#C9A84C', textDecoration: 'none' }}
            >
              View Listing →
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
