import { PrimaryActionButton } from '../ui/PrimaryActionButton';
import { Table } from '../ui/Table';
import { Pagination } from '../ui/Pagination';

export default function PeopleSectionLayout({
    title,
    titleTestId,
    description,
    primaryAction,
    filterBar,
    tableProps,
    items,
    renderRow,
    paginationProps,
    children,
    topContent
}) {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 data-testid={titleTestId} className="flex items-center gap-3 text-3xl font-bold text-(--text-primary)">
                        <span>{title}</span>
                    </h1>
                    <p className="text-(--text-secondary) mt-1">{description}</p>
                </div>
                {primaryAction && (
                    <PrimaryActionButton
                        icon={primaryAction.icon}
                        label={primaryAction.label}
                        onClick={primaryAction.onClick}
                    />
                )}
            </div>

            {topContent}

            {filterBar}

            <Table
                isEmpty={tableProps.isEmpty}
                emptyMessage={tableProps.emptyMessage}
                columns={tableProps.columns}
            >
                {items.map(renderRow)}
            </Table>

            {paginationProps && (
                <Pagination
                    totalItems={paginationProps.totalItems}
                    itemsPerPage={paginationProps.itemsPerPage}
                    currentPage={paginationProps.currentPage}
                    onPageChange={paginationProps.onPageChange}
                />
            )}

            {children}
        </div>
    );
}
